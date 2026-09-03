import type { OfflineAssistantCapability, OfflineCapabilityReport, OfflineInputCapabilityReport } from './contracts';
import type { SpeechLanguageCapability } from './stt';

export interface OfflineAssistantRuntimeCapabilities {
  readonly textGeneration: boolean;
  readonly workTools: boolean;
  readonly historyTools: boolean;
  readonly financeTools: boolean;
  readonly speechToText: boolean;
  readonly speechLanguages: readonly SpeechLanguageCapability[];
}

export function getOfflineAssistantCapabilities(runtime: OfflineAssistantRuntimeCapabilities): readonly OfflineCapabilityReport[] {
  const report = (capability: OfflineAssistantCapability, supported: boolean, reason: string): OfflineCapabilityReport =>
    supported ? { capability, status: 'SUPPORTED' } : { capability, status: 'UNAVAILABLE', reason };

  return [
    report('TEXT_INPUT', runtime.textGeneration, 'No verified local text-generation runtime is available.'),
    report('CREATE_WORK_ENTRY', runtime.workTools && runtime.textGeneration, 'Work Assistant tools or the local text-generation runtime are unavailable.'),
    report('READ_WORK_HISTORY', runtime.historyTools && runtime.textGeneration, 'History Assistant tools or the local text-generation runtime are unavailable.'),
    report('FINANCE_CONTROL', runtime.financeTools && runtime.textGeneration, 'Finance Assistant tools or the local text-generation runtime are unavailable.'),
    report('VOICE_INPUT', runtime.speechToText && runtime.speechLanguages.length > 0, 'No verified offline Speech-to-Text runtime with advertised languages is available.'),
  ];
}

export const OFFLINE_INPUT_CAPABILITIES: readonly OfflineInputCapabilityReport[] = [
  { input: 'TEXT', status: 'SUPPORTED' },
  { input: 'AUDIO', status: 'UNAVAILABLE', reason: 'Audio requires a verified offline Speech-to-Text runtime.' },
  { input: 'IMAGE', status: 'NOT_SUPPORTED', reason: 'Images are outside the Offline Work Assistant boundary.' },
];
