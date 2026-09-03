import assert from 'node:assert/strict';
import { createAssistantLanguageMetadata, CORE_ASSISTANT_LANGUAGES, getVoiceCapabilityReport } from './language';
import { OFFLINE_INPUT_CAPABILITIES } from './capabilities';
import { validateAssistantCommand } from './validation';
import { unavailableOfflineSpeechToTextProvider } from './stt';
import { createOfflineVoiceAssistantPipeline } from './pipeline';
import type { AudioInput } from './audio';

const work = validateAssistantCommand({
  intent: 'create_work_entry',
  itemName: 'Design',
  quantity: '2',
  rate: '10',
});
assert.equal(work.intent, 'create_work_entry');

const history = validateAssistantCommand({
  intent: 'get_work_history',
  query: 'meri pichlay haftay ki work history',
  period: 'week',
});
assert.equal(history.intent, 'get_work_history');

const finance = validateAssistantCommand({
  intent: 'finance',
  operation: 'CREATE_FINANCE_RECEIVED',
  entryType: 'payment',
  amount: '100',
});
assert.equal(finance.intent, 'finance');

assert.throws(() => validateAssistantCommand({ intent: 'finance', operation: 'DROP_DATABASE' }), /FINANCE_OPERATION_NOT_ALLOWED/);
assert.throws(() => validateAssistantCommand({ intent: 'create_work_entry', itemName: 'x', quantity: '1', rate: '2', sql: 'select *' }), /ASSISTANT_COMMAND_INVALID_FIELDS/);
assert.throws(() => validateAssistantCommand({ intent: 'get_work_history', period: 'week', person: 'Ahmed' }), /ASSISTANT_COMMAND_INVALID_FIELDS/);
assert.equal(OFFLINE_INPUT_CAPABILITIES.find((item) => item.input === 'IMAGE')?.status, 'NOT_SUPPORTED');
assert.deepEqual(CORE_ASSISTANT_LANGUAGES.slice(0, 4), ['en', 'ur', 'roman-ur', 'mixed']);
assert.deepEqual(createAssistantLanguageMetadata('roman-ur'), { inputLanguage: 'roman-ur', responseLanguage: 'roman-ur' });
assert.equal(getVoiceCapabilityReport(false, []).status, 'UNAVAILABLE');
assert.equal((await unavailableOfflineSpeechToTextProvider.isAvailable()), false);
assert.deepEqual(await unavailableOfflineSpeechToTextProvider.getSupportedLanguages(), []);

const audio: AudioInput = { encoding: 'pcm_s16le', sampleRateHz: 16000, channels: 1, durationMs: 100, data: new ArrayBuffer(0) };
let sttCalled = false;
const controller = new AbortController();
controller.abort();
const pipeline = createOfflineVoiceAssistantPipeline(
  {
    async isAvailable() { return true; },
    async getSupportedLanguages() { return [{ languageCode: 'en', displayName: 'English' }]; },
    async transcribe() { sttCalled = true; return { text: 'unused' }; },
  },
  { async extract() { return { intent: 'get_work_history', period: 'week' }; } },
  {
    work: { async execute() { return { ok: true }; } },
    history: { async execute() { return { ok: true }; } },
    finance: { async execute() { return { ok: true }; } },
  },
);
await assert.rejects(() => pipeline.transcribeAndExecute(audio, { language: createAssistantLanguageMetadata('en'), signal: controller.signal }), /cancelled/);
assert.equal(sttCalled, false);
