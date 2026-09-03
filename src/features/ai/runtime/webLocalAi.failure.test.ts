import assert from 'node:assert/strict';
import { preparePrimaryModel } from './webLocalAi';
import { LocalInferenceRuntimeError, type LocalInferenceEngineAdapter } from './localInferenceContracts';
import { DefaultLocalInferenceRuntime } from './localInferenceRuntime';
import { ModelManager } from '../model/modelManager';
import { InMemoryModelRegistry } from '../model/modelRegistry';
import { PRIMARY_LOCAL_TEXT_MODEL } from '../model/primaryLocalTextModel';
import { sha256Hex } from '../model/sha256';
import type { AiModel, DeviceCapabilityProvider, ModelDownloader, ModelStorage } from '../model/modelContracts';
import type { DeviceCapability } from '../device/deviceCapability';

const capability: DeviceCapability = { supported: true, tier: 'STANDARD', availableRam: 5 * 1024 ** 3, totalRam: 6 * 1024 ** 3, cpuCores: 8, architecture: 'x86_64', androidVersion: null, availableStorage: 10 * 1024 ** 3, thermalState: 'nominal', batteryLevel: 1, isCharging: true, reason: null, limitations: [], platform: 'web' };
class Device implements DeviceCapabilityProvider { getDeviceCapability(): Promise<DeviceCapability> { return Promise.resolve(capability); } }
class Storage implements ModelStorage {
  private readonly files = new Map<string, Blob>();
  constructor(private readonly readFailure = false, private readonly writeFailure = false) {}
  getModelPath(model: AiModel): string { return `${model.id}/${model.version}`; }
  async exists(model: AiModel): Promise<boolean> { return (await this.read(model)) !== null; }
  async getSize(model: AiModel): Promise<number | null> { return (await this.read(model))?.size ?? null; }
  async write(model: AiModel, data: Blob): Promise<void> { if (this.writeFailure) throw new Error('storage write failed'); this.files.set(this.getModelPath(model), data); }
  async read(model: AiModel): Promise<Blob | null> { if (this.readFailure) throw new Error('storage read failed'); return this.files.get(this.getModelPath(model)) ?? null; }
  async delete(model: AiModel): Promise<void> { this.files.delete(this.getModelPath(model)); }
  async verifyChecksum(model: AiModel): Promise<boolean> { const data = await this.read(model); return !!data && !!model.sha256 && (await sha256Hex(data)) === model.sha256.toLowerCase(); }
}
class Downloader implements ModelDownloader { constructor(private readonly data: Blob) {} async download(): Promise<Blob> { return this.data; } cancel(): void {} }
class Adapter implements LocalInferenceEngineAdapter {
  readonly name = 'test'; readonly streaming = true; readonly cancellation = true; readonly capabilities = { textGeneration: true, visionInput: false, multimodalInput: false, streaming: true, cancellation: true };
  constructor(private readonly fail = false) {}
  async initialize(): Promise<void> { if (this.fail) throw new Error('runtime init failed'); }
  async loadModel(): Promise<void> {}
  async unloadModel(): Promise<void> {}
  async generate(): Promise<never> { throw new Error('not used'); }
  async *stream(): AsyncIterable<never> {}
  async cancel(): Promise<void> {}
  async dispose(): Promise<void> {}
}
function model(sha256: string): AiModel { return { ...PRIMARY_LOCAL_TEXT_MODEL, version: 'test', sha256, status: 'NOT_INSTALLED', availability: 'UNKNOWN' }; }
function manager(storage: ModelStorage, item: AiModel): ModelManager { const m = new ModelManager(new InMemoryModelRegistry(), storage, new Device()); m.registerModel(item); return m; }

async function run(): Promise<void> {
  const readModel = model('0'.repeat(64)); const readStorage = new Storage(true);
  await assert.rejects(() => preparePrimaryModel(manager(readStorage, readModel), readStorage, new Downloader(new Blob(['x'])), new DefaultLocalInferenceRuntime(new Adapter())), (error: unknown) => error instanceof LocalInferenceRuntimeError && error.code === 'MODEL_STORAGE_READ_FAILED');

  const writeData = new Blob(['x']); const writeModel = model(await sha256Hex(writeData)); const writeStorage = new Storage(false, true);
  await assert.rejects(() => preparePrimaryModel(manager(writeStorage, writeModel), writeStorage, new Downloader(writeData), new DefaultLocalInferenceRuntime(new Adapter())), (error: unknown) => error instanceof LocalInferenceRuntimeError && error.code === 'MODEL_STORAGE_WRITE_FAILED');

  const runtimeData = new Blob(['runtime']); const runtimeModel = model(await sha256Hex(runtimeData)); const runtimeStorage = new Storage(); const runtime = new DefaultLocalInferenceRuntime(new Adapter(true));
  await assert.rejects(() => preparePrimaryModel(manager(runtimeStorage, runtimeModel), runtimeStorage, new Downloader(runtimeData), runtime), (error: unknown) => error instanceof LocalInferenceRuntimeError && error.code === 'RUNTIME_INITIALIZATION_FAILED');
  assert.equal(runtime.getStatus(), 'ERROR');
  console.log('webLocalAi.failure.test.ts: PASS');
}
run().catch((error: unknown) => { console.error(error); throw error; });
