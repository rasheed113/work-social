import { PRIMARY_LOCAL_TEXT_MODEL } from './primaryLocalTextModel';
import { ModelManager } from './modelManager';
import { InMemoryModelRegistry } from './modelRegistry';
import { sha256Hex } from './sha256';
import type { AiModel, DeviceCapabilityProvider, ModelStorage } from './modelContracts';
import type { DeviceCapability } from '../device/deviceCapability';

const GIB = 1024 ** 3;

const capability = (overrides: Partial<DeviceCapability> = {}): DeviceCapability => ({
  supported: true, tier: 'STANDARD', availableRam: 5 * GIB, totalRam: 6 * GIB, cpuCores: 8,
  architecture: 'arm64-v8a', androidVersion: '35', availableStorage: 10 * GIB,
  thermalState: 'nominal', batteryLevel: 1, isCharging: true, reason: null, limitations: [], platform: 'android', ...overrides,
});

class TestStorage implements ModelStorage {
  readonly unrelated = new Blob(['unrelated']);
  private readonly files = new Map<string, Blob>([['unrelated', this.unrelated]]);
  getModelPath(model: AiModel): string { return `models/${model.id}/${model.version}`; }
  async exists(model: AiModel): Promise<boolean> { return this.files.has(this.getModelPath(model)); }
  async getSize(model: AiModel): Promise<number | null> { return (await this.read(model))?.size ?? null; }
  async write(model: AiModel, data: Blob): Promise<void> { this.files.set(this.getModelPath(model), data); }
  async read(model: AiModel): Promise<Blob | null> { return this.files.get(this.getModelPath(model)) ?? null; }
  async delete(model: AiModel): Promise<void> { this.files.delete(this.getModelPath(model)); }
  async verifyChecksum(model: AiModel): Promise<boolean> {
    if (!model.sha256) return false;
    const data = await this.read(model);
    return data ? (await sha256Hex(data)) === model.sha256.toLowerCase() : false;
  }
  hasUnrelatedData(): boolean { return this.files.get('unrelated') === this.unrelated; }
}

class TestDevice implements DeviceCapabilityProvider {
  constructor(private readonly current: DeviceCapability) {}
  getDeviceCapability(): Promise<DeviceCapability> { return Promise.resolve(this.current); }
}

function assert(condition: boolean, message: string): void { if (!condition) throw new Error(message); }
function assertEqual<T>(actual: T, expected: T, message: string): void { assert(actual === expected, `${message}: expected ${String(expected)}, got ${String(actual)}`); }
function modelWithChecksum(sha256: string): AiModel { return { ...PRIMARY_LOCAL_TEXT_MODEL, sha256, availability: 'UNKNOWN', status: 'NOT_INSTALLED' }; }

async function run(): Promise<void> {
  const registry = new InMemoryModelRegistry();
  const storage = new TestStorage();
  const device = new TestDevice(capability());
  const manager = new ModelManager(registry, storage, device);
  const data = new Blob(['work-social-model-manager-test']);
  const checksum = await sha256Hex(data);
  const model = modelWithChecksum(checksum);

  assertEqual(manager.registerModel(model).status, 'NOT_INSTALLED', 'registered model starts not installed');
  assertEqual(manager.getModel(model.id)?.id, model.id, 'registered model is retrievable');
  assertEqual(manager.listModels().length, 1, 'registry lists registered model');
  assertEqual(manager.getModel('missing'), undefined, 'unknown model is undefined');
  assertEqual((await manager.checkInstallationEligibility(model.id)).eligible, true, 'capable Android device is eligible');
  assertEqual(manager.getModel(model.id)?.availability, 'AVAILABLE', 'eligible model is available');

  assertEqual((await manager.installFromBlob(model.id, data)).status, 'INSTALLED', 'valid file becomes installed');
  assertEqual(manager.getModel(model.id)?.status, 'INSTALLED', 'installed status is retained');
  assertEqual((await manager.discoverInstalledModels())[0]?.status, 'INSTALLED', 'discovery verifies installed file');

  assertEqual((await manager.removeInstalledModel(model.id)).status, 'NOT_INSTALLED', 'remove returns not installed');
  assertEqual(await storage.exists(model), false, 'model file is deleted');
  assertEqual(storage.hasUnrelatedData(), true, 'unrelated storage survives model deletion');

  const mismatch = modelWithChecksum('0'.repeat(64));
  const mismatchStorage = new TestStorage();
  const mismatchManager = new ModelManager(new InMemoryModelRegistry(), mismatchStorage, device);
  mismatchManager.registerModel(mismatch);
  assertEqual((await mismatchManager.installFromBlob(mismatch.id, data)).status, 'INVALID', 'checksum mismatch is invalid');
  assertEqual(await mismatchStorage.exists(mismatch), false, 'invalid model file is removed');

  const missingFileManager = new ModelManager(new InMemoryModelRegistry(), new TestStorage(), device);
  missingFileManager.registerModel(modelWithChecksum(checksum));
  assertEqual((await missingFileManager.discoverInstalledModels())[0]?.status, 'NOT_INSTALLED', 'missing file stays not installed');

  const unknownRam = new ModelManager(new InMemoryModelRegistry(), new TestStorage(), new TestDevice(capability({ totalRam: null, tier: 'UNKNOWN' })));
  unknownRam.registerModel(model);
  const ramUnknownResult = await unknownRam.checkInstallationEligibility(model.id);
  assert(ramUnknownResult.reasons.some((r) => r.code === 'UNKNOWN_DEVICE_CAPABILITY'), 'unknown RAM is conservative');

  const lowRam = new ModelManager(new InMemoryModelRegistry(), new TestStorage(), new TestDevice(capability({ totalRam: 3 * GIB, tier: 'BASIC' })));
  lowRam.registerModel(model);
  const lowRamResult = await lowRam.checkInstallationEligibility(model.id);
  assert(lowRamResult.reasons.some((r) => r.code === 'INSUFFICIENT_RAM'), 'low RAM is rejected');
  assertEqual(lowRam.getModel(model.id)?.availability, 'UNAVAILABLE', 'ineligible model is unavailable');

  const lowStorage = new ModelManager(new InMemoryModelRegistry(), new TestStorage(), new TestDevice(capability({ availableStorage: 2 * GIB })));
  lowStorage.registerModel(model);
  assert((await lowStorage.checkInstallationEligibility(model.id)).reasons.some((r) => r.code === 'INSUFFICIENT_STORAGE'), 'low storage is rejected');

  const unsupportedArch = new ModelManager(new InMemoryModelRegistry(), new TestStorage(), new TestDevice(capability({ architecture: 'x86_64' })));
  unsupportedArch.registerModel(model);
  assert((await unsupportedArch.checkInstallationEligibility(model.id)).reasons.some((r) => r.code === 'UNSUPPORTED_ARCHITECTURE'), 'unsupported architecture is rejected');

  const unknownArch = new ModelManager(new InMemoryModelRegistry(), new TestStorage(), new TestDevice(capability({ architecture: null })));
  unknownArch.registerModel(model);
  assert((await unknownArch.checkInstallationEligibility(model.id)).reasons.some((r) => r.code === 'UNKNOWN_DEVICE_CAPABILITY'), 'unknown architecture is rejected');

  const web = new ModelManager(new InMemoryModelRegistry(), new TestStorage(), new TestDevice(capability({ platform: 'web', supported: false })));
  web.registerModel(model);
  assert((await web.checkInstallationEligibility(model.id)).reasons.some((r) => r.code === 'UNSUPPORTED_PLATFORM'), 'web runtime is rejected for Android model');

  const oldAndroid = new ModelManager(new InMemoryModelRegistry(), new TestStorage(), new TestDevice(capability({ androidVersion: '25' })));
  oldAndroid.registerModel(model);
  assert((await oldAndroid.checkInstallationEligibility(model.id)).reasons.some((r) => r.code === 'ANDROID_VERSION_TOO_OLD'), 'old Android is rejected');

  const unknownAndroid = new ModelManager(new InMemoryModelRegistry(), new TestStorage(), new TestDevice(capability({ androidVersion: null })));
  unknownAndroid.registerModel(model);
  assert((await unknownAndroid.checkInstallationEligibility(model.id)).reasons.some((r) => r.code === 'UNKNOWN_DEVICE_CAPABILITY'), 'unknown Android version is rejected');

  const noChecksumManager = new ModelManager(new InMemoryModelRegistry(), new TestStorage(), device);
  const noChecksum = { ...PRIMARY_LOCAL_TEXT_MODEL };
  noChecksumManager.registerModel(noChecksum);
  assertEqual((await noChecksumManager.installFromBlob(noChecksum.id, data)).status, 'INVALID', 'missing checksum cannot install');

  assertEqual(manager.removeModelMetadata(model.id), true, 'registered metadata can be removed');
  assertEqual(manager.getModel(model.id), undefined, 'removed metadata is absent');
  assertEqual(manager.removeModelMetadata('missing'), false, 'unknown metadata removal is false');

  console.log('Model Manager tests passed: registry, eligibility, integrity, lifecycle, and safe deletion.');
}

run().catch((error: unknown) => { console.error(error); throw error; });
