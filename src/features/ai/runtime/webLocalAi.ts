import { getDeviceCapability } from '../device/deviceCapabilityEngine';
import { BrowserLocalInferenceAdapter } from './browserLocalInferenceAdapter';
import { ModelManager } from '../model/modelManager';
import { InMemoryModelRegistry } from '../model/modelRegistry';
import { WebModelStorage } from '../model/webModelStorage';
import { WebModelDownloader } from '../model/webModelDownloader';
import { PRIMARY_LOCAL_TEXT_MODEL } from '../model/primaryLocalTextModel';
import { DefaultLocalInferenceRuntime } from './localInferenceRuntime';
import { LocalInferenceRuntimeError, type LocalInferenceRuntime } from './localInferenceContracts';
import type { ModelDownloader, ModelStorage } from '../model/modelContracts';

const registry = new InMemoryModelRegistry();
const storage = new WebModelStorage();
const modelManager = new ModelManager(registry, storage, { getDeviceCapability });
modelManager.registerModel(PRIMARY_LOCAL_TEXT_MODEL);
const adapter = new BrowserLocalInferenceAdapter();
const runtime = new DefaultLocalInferenceRuntime(adapter);
const downloader = new WebModelDownloader();
let preparePromise: Promise<void> | null = null;

export const webLocalAi = {
  modelManager,
  runtime,
  downloader,
  async prepare(): Promise<void> {
    if (preparePromise) return preparePromise;
    preparePromise = preparePrimaryModel(modelManager, storage, downloader, runtime);
    try { await preparePromise; } finally { preparePromise = null; }
  },
};

export async function preparePrimaryModel(manager: ModelManager, modelStorage: ModelStorage, modelDownloader: ModelDownloader, localRuntime: LocalInferenceRuntime): Promise<void> {
  let discovered;
  try { discovered = await manager.discoverInstalledModels(); }
  catch (error) { throw preparationError(error, 'MODEL_STORAGE_READ_FAILED', 'The installed local model could not be read from browser storage.'); }
  const model = discovered.find((item) => item.id === PRIMARY_LOCAL_TEXT_MODEL.id) ?? manager.getModel(PRIMARY_LOCAL_TEXT_MODEL.id);
  if (!model) throw new LocalInferenceRuntimeError('MODEL_NOT_INSTALLED', 'The primary local text model is not registered.');

  let installedAndVerified = false;
  try { installedAndVerified = model.status === 'INSTALLED' && !!model.sha256 && await modelStorage.verifyChecksum(model); }
  catch (error) { throw preparationError(error, 'MODEL_STORAGE_READ_FAILED', 'The installed local model could not be verified from browser storage.'); }
  if (!installedAndVerified) {
    let eligibility;
    try { eligibility = await manager.checkInstallationEligibility(model.id); }
    catch (error) { throw preparationError(error, 'MODEL_INCOMPATIBLE', 'The local model eligibility check failed.'); }
    if (!eligibility.eligible) throw new LocalInferenceRuntimeError('MODEL_INCOMPATIBLE', eligibility.reasons.map((reason) => reason.message).join(' '));
    let blob: Blob;
    try { blob = await modelDownloader.download(model); }
    catch (error) { throw preparationError(error, 'MODEL_DOWNLOAD_FAILED', 'The local model download failed.'); }
    const result = await manager.installFromBlob(model.id, blob);
    if (result.status !== 'INSTALLED') {
      if (result.status === 'INVALID') throw new LocalInferenceRuntimeError('MODEL_INVALID', 'The downloaded local model failed checksum verification.');
      throw new LocalInferenceRuntimeError('MODEL_STORAGE_WRITE_FAILED', 'The local model could not be persisted in browser storage.');
    }
  }

  let verifiedModel;
  try { verifiedModel = await manager.getVerifiedModelReference(model.id); }
  catch (error) {
    const code = error instanceof LocalInferenceRuntimeError ? error.code : 'MODEL_STORAGE_READ_FAILED';
    if (code === 'MODEL_INVALID') throw error;
    throw preparationError(error, code === 'MODEL_NOT_INSTALLED' ? 'MODEL_NOT_INSTALLED' : 'MODEL_STORAGE_READ_FAILED', 'The verified local model could not be read from browser storage.');
  }
  if (localRuntime.getStatus() === 'UNINITIALIZED') await localRuntime.initialize();
  await localRuntime.loadModel(verifiedModel);
  if (localRuntime.getStatus() !== 'MODEL_READY') throw new LocalInferenceRuntimeError('MODEL_LOAD_FAILED', `Expected MODEL_READY, got ${localRuntime.getStatus()}.`);
}

function preparationError(error: unknown, fallbackCode: 'MODEL_DOWNLOAD_FAILED' | 'MODEL_STORAGE_READ_FAILED' | 'MODEL_INCOMPATIBLE' | 'MODEL_NOT_INSTALLED', fallbackMessage: string): LocalInferenceRuntimeError {
  if (error instanceof LocalInferenceRuntimeError) return error;
  return new LocalInferenceRuntimeError(fallbackCode, fallbackMessage);
}
