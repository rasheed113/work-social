import { getDeviceCapability } from '../device/deviceCapabilityEngine';
import { BrowserLocalInferenceAdapter } from './browserLocalInferenceAdapter';
import { ModelManager } from '../model/modelManager';
import { InMemoryModelRegistry } from '../model/modelRegistry';
import { WebModelStorage } from '../model/webModelStorage';
import { WebModelDownloader } from '../model/webModelDownloader';
import { PRIMARY_LOCAL_TEXT_MODEL } from '../model/primaryLocalTextModel';
import { DefaultLocalInferenceRuntime } from './localInferenceRuntime';
import type { LocalInferenceRuntime } from './localInferenceContracts';
import type { ModelDownloader, ModelStorage } from '../model/modelContracts';

const registry = new InMemoryModelRegistry();
const storage = new WebModelStorage();
const modelManager = new ModelManager(registry, storage, { getDeviceCapability });
modelManager.registerModel(PRIMARY_LOCAL_TEXT_MODEL);

const adapter = new BrowserLocalInferenceAdapter();
const runtime = new DefaultLocalInferenceRuntime(adapter);
const downloader = new WebModelDownloader();

let preparePromise: Promise<void> | null = null;

/** Shared browser-local AI composition root. All model access stays behind ModelManager. */
export const webLocalAi = {
  modelManager,
  runtime,
  downloader,
  async prepare(): Promise<void> {
    if (preparePromise) return preparePromise;
    preparePromise = preparePrimaryModel(modelManager, storage, downloader, runtime);
    try { await preparePromise; }
    finally { preparePromise = null; }
  },
};

/**
 * Prepares the primary local model and activates the executable browser runtime.
 * ModelManager remains the only authority that can issue the verified runtime handoff.
 */
export async function preparePrimaryModel(
  manager: ModelManager,
  modelStorage: ModelStorage,
  modelDownloader: ModelDownloader,
  localRuntime: LocalInferenceRuntime,
): Promise<void> {
  const discovered = await manager.discoverInstalledModels();
  const model = discovered.find((item) => item.id === PRIMARY_LOCAL_TEXT_MODEL.id) ?? manager.getModel(PRIMARY_LOCAL_TEXT_MODEL.id);
  if (!model) throw new Error('LOCAL_MODEL_NOT_REGISTERED: primary local text model is not registered.');

  const installedAndVerified = model.status === 'INSTALLED' && model.sha256 && await modelStorage.verifyChecksum(model);
  if (!installedAndVerified) {
    const eligibility = await manager.checkInstallationEligibility(model.id);
    if (!eligibility.eligible) throw new Error(`LOCAL_MODEL_INELIGIBLE: ${eligibility.reasons.map((reason) => reason.code).join(', ')}`);
    const blob = await modelDownloader.download(model);
    const result = await manager.installFromBlob(model.id, blob);
    if (result.status !== 'INSTALLED') throw new Error(`LOCAL_MODEL_INSTALL_FAILED: ${result.status}.`);
  }

  // Never hand raw model metadata or storage bytes to the runtime. Re-verify and obtain
  // the branded reference immediately before execution, including the already-installed path.
  const verifiedModel = await manager.getVerifiedModelReference(model.id);
  if (localRuntime.getStatus() === 'UNINITIALIZED') await localRuntime.initialize();
  await localRuntime.loadModel(verifiedModel);
  if (localRuntime.getStatus() !== 'MODEL_READY') {
    throw new Error(`LOCAL_RUNTIME_NOT_READY: expected MODEL_READY, got ${localRuntime.getStatus()}.`);
  }
}
