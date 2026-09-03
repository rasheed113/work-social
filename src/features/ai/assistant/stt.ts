import type { AssistantLanguage } from './contracts';
import type { AudioInput } from './audio';

export interface SpeechLanguageCapability {
  readonly languageCode: string;
  readonly displayName: string;
}

export interface SpeechToTextOptions {
  readonly languageHint?: AssistantLanguage;
  readonly autoDetect?: boolean;
  readonly signal?: AbortSignal;
}

export interface SpeechToTextResult {
  readonly text: string;
  readonly language?: AssistantLanguage;
  readonly confidence?: number;
}

export type SpeechToTextErrorCode =
  | 'VOICE_INPUT_UNAVAILABLE'
  | 'MICROPHONE_PERMISSION_REQUIRED'
  | 'AUDIO_CAPTURE_FAILED'
  | 'STT_RUNTIME_UNAVAILABLE'
  | 'STT_MODEL_UNAVAILABLE'
  | 'STT_INITIALIZATION_FAILED'
  | 'STT_TRANSCRIPTION_FAILED'
  | 'STT_LANGUAGE_UNSUPPORTED'
  | 'STT_CANCELLED';

export class OfflineSpeechToTextError extends Error {
  readonly code: SpeechToTextErrorCode;

  constructor(code: SpeechToTextErrorCode, message: string) {
    super(message);
    this.name = 'OfflineSpeechToTextError';
    this.code = code;
  }
}

export interface OfflineSpeechToTextProvider {
  isAvailable(): Promise<boolean>;
  getSupportedLanguages(): Promise<readonly SpeechLanguageCapability[]>;
  transcribe(audio: AudioInput, options?: SpeechToTextOptions): Promise<SpeechToTextResult>;
  cancel?(signal?: AbortSignal): void;
}

export const unavailableOfflineSpeechToTextProvider: OfflineSpeechToTextProvider = {
  async isAvailable() { return false; },
  async getSupportedLanguages() { return []; },
  async transcribe() {
    throw new OfflineSpeechToTextError('STT_RUNTIME_UNAVAILABLE', 'No offline Speech-to-Text runtime is installed.');
  },
};
