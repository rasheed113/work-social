import { getDeviceCapability } from '../device/deviceCapabilityEngine';
import { BrowserLocalInferenceAdapter } from './browserLocalInferenceAdapter';
import { ModelManager } from '../model/modelManager';
import { InMemoryModelRegistry } from '../model/modelRegistry';
import { WebModelStorage } from '../model/webModelStorage';
import { WebModelDownloader } from '../model/webModelDownloader';
import { PRIMARY_LOCAL_TEXT_MODEL } from '../model/primaryLocalTextModel';
import { DefaultLocalInferenceRuntime } from './localInferenceRuntime';

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
    preparePromise = preparePrimaryModel();
    try { await preparePromise; }
    finally { preparePromise = null; }
  },
};

async function preparePrimaryModel(): Promise<void> {
  const discovered = await modelManager.discoverInstalledModels();
  const model = discovered.find((item) => item.id === PRIMARY_LOCAL_TEXT_MODEL.id) ?? modelManager.getModel(PRIMARY_LOCAL_TEXT_MODEL.id);
  if (!model) throw new Error('LOCAL_MODEL_NOT_REGISTERED: primary local text model is not registered.');
  if (model.status === 'INSTALLED' && model.sha256 && await storage.verifyChecksum(model)) return;
  const eligibility = await modelManager.checkInstallationEligibility(model.id);
  if (!eligibility.eligible) throw new Error(`LOCAL_MODEL_INELIGIBLE: ${eligibility.reasons.map((reason) => reason.code).join(', ')}`);
  const blob = await downloader.download(model);
  const result = await modelManager.installFromBlob(model.id, blob);
  if (result.status !== 'INSTALLED') throw new Error(`LOCAL_MODEL_INSTALL_FAILED: ${result.status}.`);
}
