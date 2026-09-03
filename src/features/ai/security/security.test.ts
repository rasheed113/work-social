import 'fake-indexeddb/auto';
import { indexedDB } from 'fake-indexeddb';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { validateVisionImage, validateVisionImages } from '../vision/imageValidator';
import { AiRouter } from '../providers/aiRouter';
import type { AiAttachment, AiProvider, AiResponse } from '../providers/contracts';
import { DefaultLocalInferenceRuntime } from '../runtime/localInferenceRuntime';
import { verifiedModelReferenceBrand, type LocalInferenceEngineAdapter, type VerifiedLocalModelReference } from '../runtime/localInferenceContracts';
import type { AiModel } from '../model/modelContracts';
import { IndexedDbAiHistoryStore } from '../history/indexedDbAiHistoryStore';
import { sanitizeErrorMessage } from './security';

const now = '2026-09-02T18:00:00.000Z';
function assert(condition: boolean, message: string): void { if (!condition) throw new Error(message); }
async function expectCode(run: () => Promise<unknown>, code: string): Promise<void> { try { await run(); throw new Error(`Expected ${code}.`); } catch (error) { if (!(error instanceof Error) || !('code' in error) || String((error as { code: unknown }).code) !== code) throw error; } }
function attachment(overrides: Partial<AiAttachment> = {}): AiAttachment { return { id: 'image-1', kind: 'image', mimeType: 'image/png', ...overrides }; }
function png(width = 1, height = 1): Blob { const bytes = new Uint8Array([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0,0,0,13,0x49,0x48,0x44,0x52,(width>>>24)&255,(width>>>16)&255,(width>>>8)&255,width&255,(height>>>24)&255,(height>>>16)&255,(height>>>8)&255,height&255,8,6,0,0,0,0,0,0,0]); return new Blob([bytes], { type: 'image/png' }); }
function jpeg(): Blob { return new Blob([new Uint8Array([0xff,0xd8,0xff,0xc0,0x00,0x11,0x08,0x00,0x01,0x00,0x01,0x03,0x01,0x11,0x00,0x02,0x11,0x00,0x03,0x11,0x00,0xff,0xd9])], { type: 'image/jpeg' }); }
function webp(): Blob { return new Blob([new Uint8Array([0x52,0x49,0x46,0x46,0x16,0x00,0x00,0x00,0x57,0x45,0x42,0x50,0x56,0x50,0x38,0x58,0x0a,0x00,0x00,0x00,0,0,0,0,0,0,0,0,0,0])], { type: 'image/webp' }); }

async function imageSecurity(): Promise<void> {
  for (const data of [jpeg(), png(), webp()]) { const result = await validateVisionImage(attachment({ mimeType: data.type, data })); assert(result.dimensions.verifiedFromBytes && result.dimensions.width === 1 && result.dimensions.height === 1, `valid ${data.type} dimensions were not verified`); }
  await expectCode(() => validateVisionImage(attachment({ mimeType: 'image/gif' })), 'UNSUPPORTED_IMAGE_TYPE');
  await expectCode(() => validateVisionImage(attachment({ data: new Blob(['x'.repeat(32)], { type: 'image/png' }) })), 'INVALID_IMAGE_METADATA');
  await expectCode(() => validateVisionImage(attachment({ metadata: { declaredSizeBytes: 25 * 1024 * 1024 + 1 } })), 'IMAGE_TOO_LARGE');
  await expectCode(() => validateVisionImages(Array.from({ length: 9 }, (_, index) => attachment({ id: `image-${index}` }))), 'IMAGE_COUNT_EXCEEDED');
  await expectCode(() => validateVisionImage(attachment({ metadata: { declaredSizeBytes: Number.POSITIVE_INFINITY } })), 'INVALID_IMAGE_METADATA');
  await expectCode(() => validateVisionImage(attachment({ id: '../escape' })), 'INVALID_IMAGE_METADATA');
  await expectCode(() => validateVisionImage(attachment({ id: undefined, url: 'javascript:alert(1)' })), 'INVALID_IMAGE_METADATA');
  await expectCode(() => validateVisionImage(attachment({ id: undefined, url: 'https://example.com/image.png' })), 'INVALID_IMAGE_METADATA');
  const blobUrl = 'blob:https://work-social.example/123'; const preserved = await validateVisionImage(attachment({ id: undefined, url: blobUrl })); assert(preserved.reference === blobUrl, 'legitimate blob object URL was rejected');
  await expectCode(() => validateVisionImage(attachment({ id: undefined, url: 'data:image/png;base64,AAAA' })), 'INVALID_IMAGE_METADATA');
  await expectCode(() => validateVisionImage(attachment({ id: 'safe', name: '../secret.png' })), 'INVALID_IMAGE_METADATA');
  await expectCode(() => validateVisionImage(attachment({ id: 'safe', data: png(16_385, 1) })), 'INVALID_IMAGE_METADATA');
}

async function routerSecurity(): Promise<void> {
  let geminiCalls = 0;
  const gemini: AiProvider = { id: 'gemini', mode: 'online', getStatus: () => ({ state: 'ready', provider: 'gemini', mode: 'online' }), sendMessage: async (): Promise<AiResponse> => { geminiCalls += 1; throw new Error('Gemini must not be invoked.'); } };
  const local: AiProvider & { getRoutingStatus: () => Promise<{ state: 'unavailable'; provider: 'local'; mode: 'offline'; reason: string; reasonCode: 'VISION_RUNTIME_UNAVAILABLE' }> } = { id: 'local', mode: 'offline', getStatus: () => ({ state: 'unavailable', provider: 'local', mode: 'offline', reason: 'vision unavailable', reasonCode: 'VISION_RUNTIME_UNAVAILABLE' }), getRoutingStatus: async () => ({ state: 'unavailable', provider: 'local', mode: 'offline', reason: 'vision unavailable', reasonCode: 'VISION_RUNTIME_UNAVAILABLE' }), sendMessage: async (): Promise<AiResponse> => { throw new Error('Local provider should not execute when unavailable.'); } };
  const router = new AiRouter(gemini, local); await expectCode(() => router.route('offline', [attachment()]), 'VISION_RUNTIME_UNAVAILABLE'); assert(geminiCalls === 0, 'offline image route invoked Gemini');
}

async function runtimeErrorSecurity(): Promise<void> {
  const model: AiModel = { id: 'security-model', name: 'Security Model', version: '1', type: 'TEXT', format: 'GGUF', sizeBytes: 1, sha256: '0'.repeat(64), architectureRequirements: { supportedArchitectures: ['arm64-v8a'] }, memoryRequirements: { requiredRamBytes: 1 }, storageRequirements: { requiredFreeStorageBytes: 1 }, platformRequirements: { requiredPlatform: 'any' }, downloadSource: null, availability: 'AVAILABLE', status: 'INSTALLED' };
  const reference: VerifiedLocalModelReference = { model, [verifiedModelReferenceBrand]: true, readVerifiedModel: async () => new Blob(['model']) };
  const adapter: LocalInferenceEngineAdapter = { name: 'security-test', streaming: false, cancellation: false, initialize: async () => undefined, loadModel: async () => undefined, unloadModel: async () => undefined, generate: async () => { throw new Error('request failed: Authorization: Bearer SECRET_TOKEN /private/work-social/model.gguf'); }, stream: async function* () { yield { type: 'COMPLETE' as const, response: { text: '', finishReason: 'STOP' as const, usage: { promptTokens: null, completionTokens: null, totalTokens: null }, runtimeMetadata: { provider: 'local' as const, runtime: 'security-test', modelId: model.id, modelVersion: model.version } } }; }, cancel: async () => undefined, dispose: async () => undefined };
  const runtime = new DefaultLocalInferenceRuntime(adapter); await runtime.initialize(); await runtime.loadModel(reference);
  try { await runtime.generate({ messages: [{ id: 'm', conversationId: 'c', role: 'user', content: 'test' }], modality: 'TEXT' }); throw new Error('Expected runtime failure.'); } catch (error) { const message = error instanceof Error ? error.message : ''; assert(/INFERENCE_FAILED|Local inference failed|request failed/i.test(message) || 'code' in (error as object), 'runtime did not return a structured error'); assert(!/SECRET_TOKEN|Authorization:\s*Bearer|\/private\//i.test(message), 'runtime error leaked credential or private path'); }
  const untrustedRuntime = new DefaultLocalInferenceRuntime(adapter); await untrustedRuntime.initialize(); await expectCode(() => untrustedRuntime.loadModel({ model } as unknown as VerifiedLocalModelReference), 'INVALID_MODEL_REFERENCE');
  assert(sanitizeErrorMessage('Authorization: Bearer SECRET_TOKEN cookie: sid=SECRET').includes('[REDACTED]'), 'error sanitizer did not redact credentials');
}

async function historySecurity(): Promise<void> {
  const store = new IndexedDbAiHistoryStore(); await store.clear(); await store.createConversation({ id: 'security-history' });
  await expectCode(() => store.appendMessage('security-history', { id: 'secret-message', role: 'user', content: 'Authorization: Bearer SECRET_TOKEN', createdAt: now }), 'INVALID_ARGUMENT');
  await store.appendMessage('security-history', { id: 'bounded', role: 'user', content: 'hello', createdAt: now, attachments: [{ id: 'img', mimeType: 'image/png', name: 'x.png', size: 10, reference: 'local-image-1' }] });
  const saved = await store.getConversation('security-history'); assert(saved?.messages[0]?.attachments?.[0]?.reference === 'local-image-1', 'bounded attachment metadata was not preserved'); assert(!('data' in (saved?.messages[0]?.attachments?.[0] ?? {})), 'binary image data was persisted in history metadata'); await store.clear();
  const open = indexedDB.open('work-social-ai-history', 2); await new Promise<void>((resolve, reject) => { open.onsuccess = () => resolve(); open.onerror = () => reject(open.error); }); open.result.close();
}

async function providerIsolationSourceCheck(): Promise<void> {
  const source = await readFile(fileURLToPath(new URL('../providers/localAiProvider.ts', import.meta.url)), 'utf8');
  assert(!/GeminiAiProvider|geminiAiProvider|from ['\"]\.\.\/\.\.\/lib\/supabase|supabase|fetch\s*\(/i.test(source), 'local provider contains a cloud/network dependency');
  const runtimeSource = await readFile(fileURLToPath(new URL('../runtime/localInferenceRuntime.ts', import.meta.url)), 'utf8');
  assert(!/supabase|GeminiAiProvider|geminiAiProvider|fetch\s*\(/i.test(runtimeSource), 'local runtime contains a cloud/network dependency');
}

async function main(): Promise<void> { await imageSecurity(); await routerSecurity(); await runtimeErrorSecurity(); await historySecurity(); await providerIsolationSourceCheck(); console.log('Phase 11 security tests passed: secrets, offline routing, images, references, history, provider isolation, model-reference and error sanitization.'); }
main().catch((error) => { console.error(error); throw error; });
