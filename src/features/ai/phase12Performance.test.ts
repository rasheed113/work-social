import { buildAiContext, DEFAULT_MAX_CONTEXT_CHARACTERS } from './context/contextBuilder';
import type { AiConversation } from './history/contracts';
import { createLocalInferenceRuntime, type LocalInferenceEngineAdapter } from './runtime/localInferenceRuntime';
import { verifiedModelReferenceBrand, type InferenceResponse, type VerifiedLocalModelReference } from './runtime/localInferenceContracts';
import type { AiModel } from './model/modelContracts';
import { validateVisionImage } from './vision/imageValidator';

function assert(condition: boolean, message: string): void { if (!condition) throw new Error(message); }
function equal<T>(actual: T, expected: T, message: string): void { assert(actual === expected, `${message}: expected ${String(expected)}, got ${String(actual)}`); }

const model = {
  id: 'phase12-fixture', name: 'phase12-fixture', version: '1', type: 'TEXT', format: 'GGUF', sizeBytes: 1,
  sha256: 'a'.repeat(64), architectureRequirements: { supportedArchitectures: ['arm64-v8a'] },
  memoryRequirements: { requiredRamBytes: 1 }, storageRequirements: { requiredFreeStorageBytes: 1 },
  platformRequirements: { requiredPlatform: 'android' as const, minimumAndroidVersion: 26 },
  downloadSource: null, availability: 'AVAILABLE' as const, status: 'INSTALLED' as const,
} satisfies AiModel;

function reference(): VerifiedLocalModelReference { return { model, [verifiedModelReferenceBrand]: true, readVerifiedModel: async () => new Blob(['verified']) }; }
function response(): InferenceResponse { return { text: 'ok', finishReason: 'STOP', usage: { promptTokens: null, completionTokens: null, totalTokens: null }, runtimeMetadata: { provider: 'local', runtime: 'phase12-fixture', modelId: model.id, modelVersion: model.version } }; }

class CountingAdapter implements LocalInferenceEngineAdapter {
  readonly name = 'phase12-fixture'; readonly streaming = false; readonly cancellation = true;
  initializeCalls = 0; loadCalls = 0;
  async initialize(): Promise<void> { this.initializeCalls += 1; }
  async loadModel(): Promise<void> { this.loadCalls += 1; }
  async unloadModel(): Promise<void> {}
  async generate(): Promise<InferenceResponse> { return response(); }
  async *stream(): AsyncIterable<never> { return; }
  async cancel(): Promise<void> {}
  async dispose(): Promise<void> {}
}

function conversation(messages: AiConversation['messages']): AiConversation { return { id: 'phase12-conversation', title: null, summary: null, createdAt: '2026-09-03T00:00:00.000Z', updatedAt: '2026-09-03T00:00:00.000Z', messages }; }

async function testRuntimeDeduplication(): Promise<void> {
  const adapter = new CountingAdapter();
  const runtime = createLocalInferenceRuntime(adapter);
  await Promise.all([runtime.initialize(), runtime.initialize()]);
  equal(adapter.initializeCalls, 1, 'concurrent initialization performs one adapter initialization');
  await Promise.all([runtime.loadModel(reference()), runtime.loadModel(reference())]);
  equal(adapter.loadCalls, 1, 'concurrent loading of the same model performs one adapter load');
  equal(runtime.getStatus(), 'MODEL_READY', 'deduplicated lifecycle reaches model ready');
  await runtime.dispose();
}

function testContextBounds(): void {
  const messages = Array.from({ length: 64 }, (_, index) => ({ id: `m-${index}`, role: 'user' as const, content: 'x'.repeat(200), createdAt: '2026-09-03T00:00:00.000Z' }));
  const request = { conversationId: 'phase12-conversation', content: 'current request' };
  const result = buildAiContext(conversation(messages), request, { maxCharacters: DEFAULT_MAX_CONTEXT_CHARACTERS, maxMessages: 16, includeSummary: false });
  assert(result.messages.at(-1)?.content === request.content, 'bounded context preserves the current request');
  assert(result.messages.length <= 16, 'bounded context respects the message limit');
  assert(result.estimatedCharacters <= DEFAULT_MAX_CONTEXT_CHARACTERS, 'bounded context respects the character limit');
}

async function testVisionHeaderRead(): Promise<void> {
  const bytes = new Uint8Array(1024);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52]);
  new DataView(bytes.buffer).setUint32(16, 320, false);
  new DataView(bytes.buffer).setUint32(20, 240, false);
  const result = await validateVisionImage({ id: 'phase12-image', kind: 'image', mimeType: 'image/png', data: new Blob([bytes]), metadata: { reference: 'phase12-image' } });
  equal(result.dimensions.width, 320, 'PNG dimensions remain validated');
  equal(result.dimensions.height, 240, 'PNG height remains validated');
  equal(result.declaredSizeBytes, 1024, 'image size remains derived without metadata mutation');
}

async function run(): Promise<void> {
  await testRuntimeDeduplication();
  testContextBounds();
  await testVisionHeaderRead();
  console.log('Phase 12 performance regression tests passed: runtime deduplication, bounded context, and image header validation.');
}
run().catch((error: unknown) => { console.error(error); throw error; });