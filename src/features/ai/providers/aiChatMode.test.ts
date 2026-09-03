import assert from 'node:assert/strict';
import type { AiAttachment, AiMessage, AiProvider, AiProviderStatus, AiResponse } from './contracts';
import { AiRoutingError } from './contracts';
import { AiRouter, getDefaultAiRoutingMode, setDefaultAiRoutingMode } from './aiRouter';

const message: AiMessage = { id: 'm', conversationId: 'c', role: 'user', content: 'hello' };
const response: AiResponse = { conversationId: 'c', message: 'ok', pendingActions: [], provider: 'gemini', mode: 'online' };

function provider(
  id: 'gemini' | 'local',
  status: AiProviderStatus,
  onSend: () => void = () => undefined,
  routingStatus?: (attachments?: AiAttachment[]) => Promise<AiProviderStatus>,
): AiProvider {
  return {
    id,
    mode: id === 'gemini' ? 'online' : 'offline',
    getStatus: () => status,
    sendMessage: async () => {
      onSend();
      return { ...response, provider: id, mode: id === 'gemini' ? 'online' : 'offline' };
    },
    ...(routingStatus ? { getRoutingStatus: routingStatus } : {}),
  } as AiProvider;
}

function local(status: AiProviderStatus, onSend?: () => void): AiProvider {
  return provider('local', status, onSend, async () => status);
}

function readyLocal(onSend?: () => void): AiProvider {
  return local({
    state: 'ready',
    provider: 'local',
    mode: 'offline',
    reason: 'verified runtime/model/device ready',
    reasonCode: 'LOCAL_RUNTIME_READY',
  }, onSend);
}

function unavailableLocal(reasonCode: AiProviderStatus['reasonCode'], reason = 'not ready'): AiProvider {
  return local({ state: 'unavailable', provider: 'local', mode: 'offline', reason, reasonCode });
}

async function expectRoutingError(action: () => Promise<unknown>, code: string): Promise<void> {
  try {
    await action();
    throw new Error(`Expected ${code}, but no error was thrown.`);
  } catch (error) {
    if (!(error instanceof AiRoutingError) || error.code !== code || error.mode !== 'offline' || error.provider !== 'local') {
      throw new Error(`Expected structured offline ${code} error.`);
    }
  }
}

async function run(): Promise<void> {
  setDefaultAiRoutingMode('auto');
  assert.equal(getDefaultAiRoutingMode(), 'auto');

  let geminiCalls = 0;
  let localCalls = 0;
  const gemini = provider(
    'gemini',
    { state: 'ready', provider: 'gemini', mode: 'online' },
    () => { geminiCalls += 1; },
  );

  // The mode selected by the chat header is consumed by the same router used by the production chat API.
  setDefaultAiRoutingMode('auto');
  const autoUnavailable = new AiRouter(gemini, unavailableLocal('RUNTIME_UNAVAILABLE', 'browser runtime has no executable local adapter'));
  assert.equal((await autoUnavailable.route(getDefaultAiRoutingMode())).provider, 'gemini');
  await autoUnavailable.sendMessage([message], [], { mode: getDefaultAiRoutingMode() });
  assert.equal(geminiCalls, 1);

  setDefaultAiRoutingMode('online');
  assert.equal(getDefaultAiRoutingMode(), 'online');
  const onlineRouter = new AiRouter(gemini, readyLocal());
  assert.equal((await onlineRouter.route(getDefaultAiRoutingMode())).provider, 'gemini');
  await onlineRouter.sendMessage([message], [], { mode: getDefaultAiRoutingMode() });
  assert.equal(geminiCalls, 2);

  setDefaultAiRoutingMode('offline');
  assert.equal(getDefaultAiRoutingMode(), 'offline');
  const offlineRouter = new AiRouter(gemini, readyLocal(() => { localCalls += 1; }));
  assert.equal((await offlineRouter.route(getDefaultAiRoutingMode())).provider, 'local');
  await offlineRouter.sendMessage([message], [], { mode: getDefaultAiRoutingMode() });
  assert.equal(localCalls, 1);
  assert.equal(geminiCalls, 2);

  const blockedOffline = new AiRouter(gemini, unavailableLocal('RUNTIME_UNAVAILABLE', 'no executable local adapter'));
  await expectRoutingError(
    () => blockedOffline.sendMessage([message], [], { mode: 'offline' }),
    'RUNTIME_UNAVAILABLE',
  );
  assert.equal(geminiCalls, 2);

  setDefaultAiRoutingMode('auto');
  assert.equal(getDefaultAiRoutingMode(), 'auto');
  console.log('AI chat mode integration tests passed: AUTO, ONLINE, OFFLINE, and no-online-fallback behavior use the existing AiRouter.');
}

run().catch((error: unknown) => {
  console.error(error);
  throw error;
});
