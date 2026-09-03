import assert from 'node:assert/strict';
import type { AiMessage, AiProvider, AiProviderStatus, AiResponse } from '../providers/contracts';
import { AiRouter } from '../providers/aiRouter';
import { AiRoutingError } from '../providers/contracts';
import { sendAiMessage } from './workSocialAi';

const request: AiMessage = { id: 'test', conversationId: '', role: 'user', content: 'test' };
function fakeProvider(id: 'gemini' | 'local', ready: boolean, calls: { count: number }, responseMode?: 'online' | 'offline'): AiProvider {
  const response: AiResponse = { conversationId: 'test-conversation', message: id === 'local' ? 'LOCAL_WLLAMA_RESPONSE' : 'GEMINI_RESPONSE', pendingActions: [], provider: id, mode: responseMode ?? (id === 'local' ? 'offline' : 'online') };
  const status: AiProviderStatus = { state: ready ? 'ready' : 'unavailable', provider: id, mode: id === 'local' ? 'offline' : 'online', reason: ready ? 'ready' : 'unavailable', reasonCode: ready ? 'LOCAL_RUNTIME_READY' : 'LOCAL_RUNTIME_UNAVAILABLE' };
  return { id, mode: id === 'local' ? 'offline' : 'online', getStatus: () => status, getRoutingStatus: async () => status, sendMessage: async () => { calls.count += 1; return response; } };
}

async function run(): Promise<void> {
  const geminiCalls = { count: 0 };
  const localCalls = { count: 0 };
  const router = new AiRouter(fakeProvider('gemini', true, geminiCalls), fakeProvider('local', true, localCalls));

  const offline = await sendAiMessage('test', null, 'offline', router);
  assert.equal(offline.message, 'LOCAL_WLLAMA_RESPONSE');
  assert.equal(offline.provider, 'local');
  assert.equal(offline.mode, 'offline');
  assert.equal(geminiCalls.count, 0);
  assert.equal(localCalls.count, 1);

  const online = await sendAiMessage('test', null, 'online', router);
  assert.equal(online.message, 'GEMINI_RESPONSE');
  assert.equal(online.provider, 'gemini');
  assert.equal(online.mode, 'online');
  assert.equal(geminiCalls.count, 1);

  const auto = await sendAiMessage('test', null, 'auto', router);
  assert.equal(auto.message, 'LOCAL_WLLAMA_RESPONSE');
  assert.equal(auto.provider, 'local');
  assert.equal(localCalls.count, 2);

  const unavailableGeminiCalls = { count: 0 };
  const unavailableLocalCalls = { count: 0 };
  const unavailableRouter = new AiRouter(fakeProvider('gemini', true, unavailableGeminiCalls), fakeProvider('local', false, unavailableLocalCalls));
  await assert.rejects(
    () => sendAiMessage('test', null, 'offline', unavailableRouter),
    (error: unknown) => error instanceof AiRoutingError && error.mode === 'offline' && error.provider === 'local' && error.code === 'LOCAL_RUNTIME_UNAVAILABLE',
  );
  assert.equal(unavailableGeminiCalls.count, 0);
  assert.equal(unavailableLocalCalls.count, 0);

  const spoofingRouter = new AiRouter(fakeProvider('gemini', true, { count: 0 }), fakeProvider('local', true, { count: 0 }, 'online'));
  await assert.rejects(
    () => sendAiMessage('test', null, 'offline', spoofingRouter),
    (error: unknown) => error instanceof AiRoutingError && error.code === 'OFFLINE_ROUTE_VIOLATION',
  );

  console.log('sendAiMessage routing/provenance tests passed: OFFLINE local-only, ONLINE Gemini, AUTO local-ready, unavailable-local isolation, and provenance spoof protection.');
}

// CI verification branch intentionally changes no production behavior.
void run().catch((error: unknown) => { console.error(error); throw error; });
