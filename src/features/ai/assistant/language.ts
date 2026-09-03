import type { AssistantLanguage, AssistantLanguageMetadata, OfflineCapabilityReport } from './contracts';
import type { SpeechLanguageCapability } from './stt';

export const CORE_ASSISTANT_LANGUAGES: readonly AssistantLanguage[] = ['en', 'ur', 'roman-ur', 'mixed', 'unknown'];

export function createAssistantLanguageMetadata(inputLanguage: AssistantLanguage, responseLanguage: AssistantLanguage = inputLanguage): AssistantLanguageMetadata {
  return { inputLanguage, responseLanguage };
}

export function advertiseSpeechLanguages(supportedLanguages: readonly SpeechLanguageCapability[]): SpeechLanguageCapability[] {
  return supportedLanguages.map(({ languageCode, displayName }) => ({ languageCode, displayName }));
}

export function getVoiceCapabilityReport(isAvailable: boolean, supportedLanguages: readonly SpeechLanguageCapability[]): OfflineCapabilityReport {
  if (!isAvailable) return { capability: 'VOICE_INPUT', status: 'UNAVAILABLE', reason: 'No verified offline Speech-to-Text runtime is available.' };
  if (!supportedLanguages.length) return { capability: 'VOICE_INPUT', status: 'UNAVAILABLE', reason: 'The offline Speech-to-Text runtime exposes no supported languages.' };
  return { capability: 'VOICE_INPUT', status: 'SUPPORTED' };
}
