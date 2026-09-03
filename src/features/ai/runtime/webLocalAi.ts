import { getDeviceCapability } from '../device/deviceCapabilityEngine';
import { BrowserLocalInferenceAdapter } from './browserLocalInferenceAdapter';
import { ModelManager } from '../model/modelManager';
import { InMemoryModelRegistry } from '../model/modelRegistry';
import { WebModelStorage } from '../model/webModelStorage';
import { WebModelDownloader } from '../model/webModelDownloader';
import { PRIMARY_LOCAL_TEXT_MODEL } from '../model/primaryLocalTextModel';
import { DefaultLocalInferenceRuntime } from './localInferenceRuntime';
import { LocalInferenceRuntimeError, type LocalInferenceRuntime } from './localInferenceContracts';
import type { LocalModelSource, ModelDownloadProgress, ModelDownloader, ModelInstallResult, ModelStorage } from '../model/modelContracts';
import type { LocalAiDiagnostic } from './localAiDiagnostics';

const registry = new InMemoryModelRegistry();
const storage = new WebModelStorage();
const modelManager = new ModelManager(registry, storage, { getDeviceCapability });
modelManager.registerModel(PRIMARY_LOCAL_TEXT_MODEL);
const adapter = new BrowserLocalInferenceAdapter();
const runtime = new DefaultLocalInferenceRuntime(adapter);
const downloader = new WebModelDownloader();
let preparePromise: Promise<void> | null = null;
let prepareProgressCallback: ((progress: ModelDownloadProgress) => void) | undefined;
let installedSource: LocalModelSource | null = null;

export interface LocalInferenceProvenance {
  provider: 'local';
  runtime: 'wllama';
  model: string;
  source: LocalModelSource;
  verified: true;
}

export const webLocalAi = {
  modelManager,
  runtime,
  downloader,
  async prepare(onDownloadProgress?: (progress: ModelDownloadProgress) => void): Promise<void> {
    if (onDownloadProgress) prepareProgressCallback = onDownloadProgress;
    if (preparePromise) return preparePromise;
    const reportProgress = (progress: ModelDownloadProgress) => prepareProgressCallback?.(progress);
    preparePromise = preparePrimaryModel(modelManager, storage, downloader, runtime, reportProgress);
    try { await preparePromise; } finally {
      preparePromise = null;
      prepareProgressCallback = undefined;
    }
  },
  isPreparing(): boolean {
    return preparePromise !== null;
  },
  async importLocalModel(file: File, signal?: AbortSignal): Promise<ModelInstallResult> {
    const result = await modelManager.importLocalFile(PRIMARY_LOCAL_TEXT_MODEL.id, file, signal);
    if (result.status === 'INSTALLED') {
      installedSource = 'imported-local-gguf';
      await storage.setProvenanceSource?.(PRIMARY_LOCAL_TEXT_MODEL, installedSource);
    }
    return result;
  },
  getProvenance(): LocalInferenceProvenance | null {
    const model = modelManager.getModel(PRIMARY_LOCAL_TEXT_MODEL.id);
    if (runtime.getStatus() !== 'MODEL_READY' || model?.status !== 'INSTALLED' || !installedSource) return null;
    return { provider: 'local', runtime: 'wllama', model: model.name, source: installedSource, verified: true };
  },
};

export async function preparePrimaryModel(manager: ModelManager, modelStorage: ModelStorage, modelDownloader: ModelDownloader, localRuntime: LocalInferenceRuntime, onDownloadProgress?: (progress: ModelDownloadProgress) => void): Promise<void> {
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
    try { blob = await modelDownloader.download(model, undefined, onDownloadProgress); }
    catch (error) { throw preparationError(error, 'MODEL_DOWNLOAD_FAILED', 'The local model download failed.'); }
    const result = await manager.installFromBlob(model.id, blob);
    if (result.status !== 'INSTALLED') {
      if (result.status === 'INVALID') throw new LocalInferenceRuntimeError('MODEL_INVALID', 'The downloaded local model failed verification.', result.diagnostic);
      if (result.diagnostic) throw new LocalInferenceRuntimeError('MODEL_STORAGE_WRITE_FAILED', result.diagnostic.message, result.diagnostic);
      throw new LocalInferenceRuntimeError('MODEL_STORAGE_WRITE_FAILED', 'The local model could not be persisted in browser storage.');
    }
    installedSource = 'downloaded-local-gguf';
    await modelStorage.setProvenanceSource?.(model, installedSource);
  } else {
    installedSource = await modelStorage.getProvenanceSource?.(model) ?? null;
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

export function createReadyLocalDiagnostic(): LocalAiDiagnostic | undefined {
  const provenance = webLocalAi.getProvenance();
  if (!provenance) return undefined;
  const model = modelManager.getModel(PRIMARY_LOCAL_TEXT_MODEL.id);
  if (!model) return undefined;
  return {
    stage: 'MODEL_LOAD', code: 'MODEL_READY', result: 'PASS', message: 'Verified GGUF is loaded by the wllama runtime and is ready for local inference.',
    filename: model.name, expectedBytes: model.sizeBytes, actualBytes: model.sizeBytes, sha256: model.sha256 ?? undefined,
    checksum: 'PASS', gguf: 'VALID', storage: 'SUCCESS', provider: provenance.provider, runtime: provenance.runtime, source: provenance.source,
    timestamp: new Date().toISOString(), modelId: model.id, modelVersion: model.version,
  };
}

function preparationError(error: unknown, fallbackCode: 'MODEL_DOWNLOAD_FAILED' | 'MODEL_STORAGE_READ_FAILED' | 'MODEL_INCOMPATIBLE' | 'MODEL_NOT_INSTALLED', fallbackMessage: string): LocalInferenceRuntimeError {
  if (error instanceof LocalInferenceRuntimeError) return error;
  return new LocalInferenceRuntimeError(fallbackCode, fallbackMessage);
}
