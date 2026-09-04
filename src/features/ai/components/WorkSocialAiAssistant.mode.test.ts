import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const assistant = readFileSync('src/features/ai/components/WorkSocialAiAssistant.tsx', 'utf8');
const modeBridge = readFileSync('src/features/ai/components/WorkSocialAiAssistantWithMode.tsx', 'utf8');

assert.match(assistant, /interface Props \{ profileId: string; mode: AiRoutingMode; \}/);
assert.match(assistant, /export function WorkSocialAiAssistant\(\{ profileId: _profileId, mode \}: Props\)/);
assert.match(assistant, /sendAiMessage\(trimmed, conversationIdRef\.current, mode(?:, undefined, onOfflineToken)?\)/);
assert.match(modeBridge, /BaseWorkSocialAiAssistant profileId=\{profileId\} mode=\{mode\}/);
assert.match(modeBridge, /AiChatModeBridge mode=\{mode\} onModeChange=\{setMode\}/);
assert.match(modeBridge, /onModeChange\(nextMode\)/);
assert.doesNotMatch(assistant, /sendAiMessage\(trimmed, conversationIdRef\.current\)/);

console.log('UI mode propagation contract passed: selected mode is a required component dependency and reaches sendAiMessage explicitly.');
