import assert from 'node:assert/strict';
import { BrowserLocalInferenceAdapter } from './browserLocalInferenceAdapter';
import { verifiedModelReferenceBrand, type InferenceRequest, type VerifiedLocalModelReference } from './localInferenceContracts';
import { boundOfflineMessages, getOfflineWllamaThreadCount, OFFLINE_DEFAULT_MAX_TOKENS, OFFLINE_MAX_CONTEXT_MESSAGES, OFFLINE_WLLAMA_CONTEXT_SIZE } from './offlineInferenceTuning';

const model = {
  model: {
    id: 'performance-test', name: 'performance-test', version: '1', type: 'TEXT', format: 'GGUF', sizeBytes: 4, sha256: 'a'.repeat(64),
    architectureRequirements: { supportedArchitectures: ['arm64'] }, platformRequirements: { requiredPlatform: 'android' },
    memoryRequirements: { requiredRamBytes: 1 }, storageRequirements: { requiredFreeStorageBytes: 1 },
    downloadSource: null, availability: 'AVAILABLE', status: 'INSTALLED',
  },
  [verifiedModelReferenceBrand]: true,
  readVerifiedModel: async () => new Blob(['test']),
} as unknown as VerifiedLocalModelReference;

class FakeEngine {
  loadCalls = 0;
  completionCalls = 0;
  loadOptions: Record<string, unknown> | null = null;
  loaded = false;
  async loadModel(_data: Blob[], options: Record<string, unknown>) { this.loadCalls += 1; this.loadOptions = options; this.loaded = true; }
  isModelLoaded() { return this.loaded; }
  async exit() { this.loaded = false; }
  async createChatCompletion(options: Record<string, unknown>) {
    this.completionCalls += 1;
    if (options.stream) {
      return (async function* () {
        yield { choices: [{ delta: { content: 'first' }, finish_reason: null }] };
        yield { choices: [{ delta: { content: ' token' }, finish_reason: 'stop' }] };
      })();
    }
    return { choices: [{ message: { content: 'local response' }, finish_reason: 'stop' }] };
  }
  setCompat() {}
}

async function run(): Promise<void> {
  const engine = new FakeEngine();
  const adapter = new BrowserLocalInferenceAdapter(() => engine as never, async () => new Response(null, { status: 200 }), false);
  await adapter.initialize();
  await adapter.loadModel(model);
  await adapter.loadModel(model);
  await adapter.loadModel(model);
  assert.equal(engine.loadCalls, 1, 'warm MODEL_READY must not reload the GGUF');
  assert.equal(engine.loadOptions?.n_ctx, OFFLINE_WLLAMA_CONTEXT_SIZE);
  assert.equal(typeof engine.loadOptions?.n_threads, 'number');

  const request: InferenceRequest = { messages: [{ id: 'u', conversationId: 'c', role: 'user', content: 'hello' }], maxTokens: OFFLINE_DEFAULT_MAX_TOKENS, contextSize: OFFLINE_WLLAMA_CONTEXT_SIZE, temperature: 0.7, topP: 0.9 };
  const response = await adapter.generate(request, new AbortController().signal);
  assert.equal(response.text, 'local response');
  assert.equal(engine.completionCalls, 1, 'generation must reuse the loaded engine');

  const events = [] as string[];
  for await (const event of adapter.stream(request, new AbortController().signal)) events.push(event.type);
  assert.equal(events[0], 'TOKEN', 'streaming must expose the first token before completion');
  assert.equal(events.at(-1), 'COMPLETE');

  const history = Array.from({ length: 30 }, (_, index) => ({ id: `m-${index}`, conversationId: 'c', role: index % 2 ? 'assistant' : 'user', content: `message ${index} ${'x'.repeat(300)}` })) as InferenceRequest['messages'];
  const bounded = boundOfflineMessages([...history, { id: 'current', conversationId: 'c', role: 'user', content: 'current request must remain intact' }]);
  assert.equal(bounded.at(-1)?.content, 'current request must remain intact');
  assert.ok(bounded.length <= OFFLINE_MAX_CONTEXT_MESSAGES);
  assert.equal(getOfflineWllamaThreadCount(8), 4);
  assert.equal(getOfflineWllamaThreadCount(4), 2);
  assert.equal(getOfflineWllamaThreadCount(2), 1);

  await adapter.dispose();
}

void run().catch((error) => { console.error(error); process.exitCode = 1; });
