import { preparePrimaryModel } from './webLocalAi';
import { DefaultLocalInferenceRuntime } from './localInferenceRuntime';
import { LocalInferenceRuntimeError, type InferenceRequest, type InferenceResponse, type LocalInferenceEngineAdapter, type VerifiedLocalModelReference } from './localInferenceContracts';
import { ModelManager } from '../model/modelManager';
import { InMemoryModelRegistry } from '../model/modelRegistry';
import { PRIMARY_LOCAL_TEXT_MODEL } from '../model/primaryLocalTextModel';
import { sha256Hex } from '../model/sha256';
import { LocalAiProvider } from '../providers/localAiProvider';
import { AiRouter } from '../providers/aiRouter';
import type { AiModel, DeviceCapabilityProvider, ModelDownloader, ModelStorage } from '../model/modelContracts';
import type { DeviceCapability } from '../device/deviceCapability';
import type { AiResponse } from '../providers/contracts';

const GIB = 1024 ** 3;
const capability: DeviceCapability = { supported: true, tier: 'STANDARD', availableRam: 5 * GIB, totalRam: 6 * GIB, cpuCores: 8, architecture: 'x86_64', androidVersion: null, availableStorage: 10 * GIB, thermalState: 'nominal', batteryLevel: 1, isCharging: true, reason: null, limitations: [], platform: 'web' };
class TestStorage implements ModelStorage { private readonly files = new Map<string, Blob>(); getModelPath(model: AiModel): string { return `${model.id}/${model.version}`; } async exists(model: AiModel): Promise<boolean> { return this.files.has(this.getModelPath(model)); } async getSize(model: AiModel): Promise<number | null> { return (await this.read(model))?.size ?? null; } async write(model: AiModel, data: Blob): Promise<void> { this.files.set(this.getModelPath(model), data); } async read(model: AiModel): Promise<Blob | null> { return this.files.get(this.getModelPath(model)) ?? null; } async delete(model: AiModel): Promise<void> { this.files.delete(this.getModelPath(model)); } async verifyChecksum(model: AiModel): Promise<boolean> { const data = await this.read(model); return !!data && !!model.sha256 && (await sha256Hex(data)) === model.sha256.toLowerCase(); } async seed(model: AiModel, data: Blob): Promise<void> { await this.write(model, data); } }
class TestDevice implements DeviceCapabilityProvider { getDeviceCapability(): Promise<DeviceCapability> { return Promise.resolve(capability); } }
class TestDownloader implements ModelDownloader { calls = 0; constructor(private readonly data: Blob) {} async download(): Promise<Blob> { this.calls += 1; return this.data; } cancel(): void {} }
class TestAdapter implements LocalInferenceEngineAdapter {
  readonly name = 'lifecycle-test'; readonly streaming = true; readonly cancellation = true; initializeCalls = 0; loadCalls = 0; generateCalls = 0; streamCalls = 0; loaded = false;
  constructor(private readonly failInitialization = false) {}
  async initialize(): Promise<void> { this.initializeCalls += 1; if (this.failInitialization) throw new Error('test initialization failure'); }
  async loadModel(reference: VerifiedLocalModelReference): Promise<void> { this.loadCalls += 1; await reference.readVerifiedModel(); this.loaded = true; }
  async unloadModel(): Promise<void> { this.loaded = false; }
  async generate(_request: InferenceRequest): Promise<InferenceResponse> { this.generateCalls += 1; return { text: 'hello from local test engine', finishReason: 'STOP', usage: { promptTokens: null, completionTokens: null, totalTokens: null }, runtimeMetadata: { provider: 'local', runtime: this.name, modelId: PRIMARY_LOCAL_TEXT_MODEL.id, modelVersion: '1' } }; }
  async *stream(request: InferenceRequest): AsyncIterable<{ type: 'TOKEN'; text: string } | { type: 'COMPLETE'; response: InferenceResponse }> { this.streamCalls += 1; const text = request.messages.at(-1)?.content === 'ہیلو' ? 'سلام!' : 'hello from local test engine'; yield { type: 'TOKEN', text }; yield { type: 'COMPLETE', response: { ...this.generateResponse(text) } }; }
  private generateResponse(text: string): InferenceResponse { return { text, finishReason: 'STOP', usage: { promptTokens: null, completionTokens: null, totalTokens: null }, runtimeMetadata: { provider: 'local', runtime: this.name, modelId: PRIMARY_LOCAL_TEXT_MODEL.id, modelVersion: '1' } }; }
  async cancel(): Promise<void> {}
  async dispose(): Promise<void> { this.loaded = false; }
}
function assert(condition: boolean, message: string): void { if (!condition) throw new Error(message); }
function equal<T>(actual: T, expected: T, message: string): void { assert(actual === expected, `${message}: expected ${String(expected)}, got ${String(actual)}`); }
function fixtureModel(sha256: string, sizeBytes: number): AiModel { return { ...PRIMARY_LOCAL_TEXT_MODEL, version: '1', sizeBytes, sha256, status: 'NOT_INSTALLED', availability: 'UNKNOWN' }; }
function createManager(storage: TestStorage, model: AiModel): ModelManager { const manager = new ModelManager(new InMemoryModelRegistry(), storage, new TestDevice()); manager.registerModel(model); return manager; }

async function localGenerationAndOfflineIsolation(): Promise<void> {
  const data = new Blob(['generation-model']); const checksum = await sha256Hex(data); const model = fixtureModel(checksum, data.size); const storage = new TestStorage(); const manager = createManager(storage, model); const adapter = new TestAdapter(); const runtime = new DefaultLocalInferenceRuntime(adapter); await preparePrimaryModel(manager, storage, new TestDownloader(data), runtime); const local = new LocalAiProvider(runtime, manager, model.id);
  let geminiCalls = 0; const gemini = { id: 'gemini' as const, mode: 'online' as const, getStatus: () => ({ state: 'ready' as const, provider: 'gemini' as const, mode: 'online' as const }), sendMessage: async (): Promise<AiResponse> => { geminiCalls += 1; throw new Error('Gemini must not be invoked for OFFLINE.'); } }; const router = new AiRouter(gemini, local);
  equal((await router.route('offline')).provider, 'local', 'explicit offline routes to local provider');
  const english = await router.sendMessage([{ id: 'm-en', conversationId: 'c', role: 'user', content: 'Hi' }], [], { mode: 'offline' });
  equal(english.message, 'hello from local test engine', 'English offline response comes from local streaming runtime');
  equal(adapter.generateCalls, 0, 'offline provider does not use blocking generate path'); equal(adapter.streamCalls, 1, 'offline provider reaches local streaming adapter'); equal(geminiCalls, 0, 'offline generation never calls Gemini');
  const urdu = await router.sendMessage([{ id: 'm-ur', conversationId: 'c', role: 'user', content: 'ہیلو' }], [], { mode: 'offline' });
  equal(urdu.message, 'سلام!', 'Urdu offline response completes through local streaming runtime'); equal(geminiCalls, 0, 'Urdu offline generation never calls Gemini');
  await runtime.dispose();
}
async function lifecycle(): Promise<void> {
  const data = new Blob(['already-installed']); const checksum = await sha256Hex(data); const model = fixtureModel(checksum, data.size); const storage = new TestStorage(); await storage.seed(model, data); const manager = createManager(storage, model); const downloader = new TestDownloader(new Blob(['should-not-download'])); const adapter = new TestAdapter(); const runtime = new DefaultLocalInferenceRuntime(adapter); await preparePrimaryModel(manager, storage, downloader, runtime); equal(runtime.getStatus(), 'MODEL_READY', 'already-installed preparation reaches MODEL_READY'); equal(adapter.initializeCalls, 1, 'runtime initializes once'); equal(adapter.loadCalls, 1, 'verified model loads once'); equal(downloader.calls, 0, 'installed model is not redownloaded'); await runtime.dispose(); }
async function checksumFailure(): Promise<void> { const data = new Blob(['invalid']); const model = fixtureModel('0'.repeat(64), data.size); const storage = new TestStorage(); const manager = createManager(storage, model); const adapter = new TestAdapter(); const runtime = new DefaultLocalInferenceRuntime(adapter); try { await preparePrimaryModel(manager, storage, new TestDownloader(data), runtime); throw new Error('invalid checksum was accepted'); } catch (error) { assert(error instanceof LocalInferenceRuntimeError && error.code === 'MODEL_INVALID', 'invalid checksum blocks execution'); } equal(adapter.initializeCalls, 0, 'invalid model never initializes runtime'); }
async function main(): Promise<void> { await lifecycle(); await checksumFailure(); await localGenerationAndOfflineIsolation(); console.log('Browser local AI tests passed: verified lifecycle, checksum gate, English offline streaming, Urdu offline streaming, and Gemini isolation.'); }
main().catch((error: unknown) => { console.error(error); throw error; });
