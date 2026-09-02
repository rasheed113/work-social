import { evaluateLocalModel, type DeviceCapability } from '../device/deviceCapability';
import { verifiedModelReferenceBrand, type VerifiedLocalModelReference } from '../runtime/localInferenceContracts';
import type {
  AiModel, DeviceCapabilityProvider, ModelEligibilityReason, ModelEligibilityReasonCode,
  ModelEligibilityResult, ModelInstallResult, ModelStorage,
} from './modelContracts';
import type { ModelRegistry } from './modelRegistry';

/** Model lifecycle and the only authority allowed to issue a verified runtime handoff. */
export class ModelManager {
  private readonly verificationPromises = new Map<string, Promise<VerifiedLocalModelReference>>();

  constructor(
    private readonly registry: ModelRegistry,
    private readonly storage: ModelStorage,
    private readonly device: DeviceCapabilityProvider,
  ) {}
  listModels(): AiModel[] { return this.registry.listModels(); }
  getModel(id: string): AiModel | undefined { return this.registry.getModel(id); }
  registerModel(model: AiModel): AiModel { return this.registry.registerModel({ ...model, availability: 'UNKNOWN', status: 'NOT_INSTALLED' }); }

  async checkInstallationEligibility(modelId: string): Promise<ModelEligibilityResult> {
    const model = this.requireModel(modelId); const capability = await this.device.getDeviceCapability();
    const result = evaluateLocalModel(capability, {
      minimumTotalRam: model.memoryRequirements.requiredRamBytes,
      minimumFreeStorage: model.storageRequirements.requiredFreeStorageBytes,
      supportedArchitectures: model.architectureRequirements.supportedArchitectures,
      requiredPlatform: model.platformRequirements.requiredPlatform,
    });
    const reasons = result.reasons.map((message) => this.toReason(message, capability));
    const minimumAndroid = model.platformRequirements.minimumAndroidVersion;
    if (minimumAndroid !== undefined && capability.platform === 'android') {
      const version = parseAndroidMajorVersion(capability.androidVersion);
      if (version === null) reasons.push({ code: 'UNKNOWN_DEVICE_CAPABILITY', message: 'Android version is unknown; the model requirement cannot be evaluated conservatively.' });
      else if (version < minimumAndroid) reasons.push({ code: 'ANDROID_VERSION_TOO_OLD', message: `Android ${minimumAndroid} or newer is required for this model.` });
    }
    const unique = uniqueReasons(reasons);
    this.registry.updateAvailability(model.id, unique.length === 0 ? 'AVAILABLE' : 'UNAVAILABLE');
    return { eligible: unique.length === 0, reasons: unique, limitations: [...new Set(result.limitations)] };
  }

  async installFromBlob(modelId: string, data: Blob): Promise<ModelInstallResult> {
    const model = this.requireModel(modelId); const eligibility = await this.checkInstallationEligibility(modelId);
    if (!eligibility.eligible) return { model: this.requireModel(modelId), status: 'NOT_INSTALLED', eligibility };
    if (!model.sha256) {
      const invalid = this.registry.updateStatus(model.id, 'INVALID') ?? model;
      return { model: invalid, status: 'INVALID', eligibility };
    }
    this.registry.updateStatus(model.id, 'DOWNLOADING');
    try {
      await this.storage.write(model, data); this.registry.updateStatus(model.id, 'VERIFYING');
      if (!(await this.storage.verifyChecksum(model))) {
        try { await this.storage.delete(model); } catch { /* Preserve INVALID state. */ }
        const invalid = this.registry.updateStatus(model.id, 'INVALID') ?? model;
        return { model: invalid, status: 'INVALID', eligibility };
      }
      const installed = this.registry.updateStatus(model.id, 'INSTALLED') ?? model;
      return { model: installed, status: 'INSTALLED', eligibility };
    } catch {
      const failed = this.registry.updateStatus(model.id, 'FAILED') ?? model;
      return { model: failed, status: 'FAILED', eligibility };
    }
  }

  async discoverInstalledModels(): Promise<AiModel[]> {
    for (const model of this.registry.listModels()) {
      if (!(await this.storage.exists(model))) { this.registry.updateStatus(model.id, 'NOT_INSTALLED'); continue; }
      const valid = model.sha256 !== null && await this.storage.verifyChecksum(model);
      this.registry.updateStatus(model.id, valid ? 'INSTALLED' : 'INVALID');
    }
    return this.registry.listModels();
  }

  /**
   * Performs capability, installation, and checksum checks immediately before a runtime load.
   * The returned branded reference is the only model source accepted by LocalInferenceRuntime.
   * Concurrent callers for the same model share only the in-flight verification; no verification
   * result is retained after the operation settles.
   */
  async getVerifiedModelReference(modelId: string): Promise<VerifiedLocalModelReference> {
    const existing = this.verificationPromises.get(modelId);
    if (existing) return existing;
    const verification = this.verifyModelReference(modelId);
    this.verificationPromises.set(modelId, verification);
    try { return await verification; }
    finally { if (this.verificationPromises.get(modelId) === verification) this.verificationPromises.delete(modelId); }
  }

  private async verifyModelReference(modelId: string): Promise<VerifiedLocalModelReference> {
    const model = this.requireModel(modelId);
    const eligibility = await this.checkInstallationEligibility(modelId);
    if (!eligibility.eligible) throw new Error(`LOCAL_MODEL_INELIGIBLE: ${eligibility.reasons.map((r) => r.code).join(', ')}`);
    if (model.status !== 'INSTALLED' || !model.sha256 || !(await this.storage.verifyChecksum(model))) {
      this.registry.updateStatus(model.id, 'INVALID');
      throw new Error('LOCAL_MODEL_NOT_VERIFIED: model must be installed and checksum-verified before inference.');
    }
    return {
      model: { ...model },
      [verifiedModelReferenceBrand]: true,
      readVerifiedModel: async () => {
        if (!(await this.storage.verifyChecksum(model))) {
          this.registry.updateStatus(model.id, 'INVALID');
          throw new Error('LOCAL_MODEL_NOT_VERIFIED: checksum verification failed during runtime handoff.');
        }
        const data = await this.storage.read(model);
        if (!data) { this.registry.updateStatus(model.id, 'NOT_INSTALLED'); throw new Error('LOCAL_MODEL_NOT_INSTALLED: model data is missing.'); }
        return data;
      },
    };
  }

  async removeInstalledModel(modelId: string): Promise<AiModel> {
    const model = this.requireModel(modelId); this.registry.updateStatus(model.id, 'REMOVING');
    try { await this.storage.delete(model); return this.registry.updateStatus(model.id, 'NOT_INSTALLED') ?? model; }
    catch (error) { this.registry.updateStatus(model.id, 'FAILED'); throw error; }
  }
  removeModelMetadata(modelId: string): boolean { return this.registry.removeModel(modelId); }
  private requireModel(id: string): AiModel { const model = this.registry.getModel(id); if (!model) throw new Error(`Managed model ${id} was not found.`); return model; }
  private toReason(message: string, capability: DeviceCapability): ModelEligibilityReason {
    let code: ModelEligibilityReasonCode = 'UNKNOWN_DEVICE_CAPABILITY';
    if (message.includes('Total RAM is below')) code = 'INSUFFICIENT_RAM';
    else if (message.includes('Available storage is below')) code = 'INSUFFICIENT_STORAGE';
    else if (message.includes('CPU architecture') && message.includes('not supported')) code = 'UNSUPPORTED_ARCHITECTURE';
    else if (message.includes('Android/native runtime') || message.includes('does not support local AI')) code = 'UNSUPPORTED_PLATFORM';
    else if (message.includes('CPU architecture is unknown') || message.includes('storage is unknown') || message.includes('RAM is unknown')) code = 'UNKNOWN_DEVICE_CAPABILITY';
    else if (capability.platform !== 'android' && message.includes('platform')) code = 'UNSUPPORTED_PLATFORM';
    return { code, message };
  }
}
function parseAndroidMajorVersion(value: string | null): number | null { if (!value) return null; const match = value.match(/\d+/); if (!match) return null; const parsed = Number(match[0]); return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null; }
function uniqueReasons(reasons: ModelEligibilityReason[]): ModelEligibilityReason[] { const seen = new Set<string>(); return reasons.filter((reason) => { const key = `${reason.code}:${reason.message}`; if (seen.has(key)) return false; seen.add(key); return true; }); }
