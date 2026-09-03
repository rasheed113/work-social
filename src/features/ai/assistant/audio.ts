export type AudioEncoding = 'pcm_s16le' | 'pcm_f32le' | 'wav' | 'opus' | 'webm-opus';

export interface AudioInput {
  readonly encoding: AudioEncoding;
  readonly sampleRateHz: number;
  readonly channels: number;
  readonly durationMs: number;
  readonly data: ArrayBuffer;
}

export interface AudioCaptureOptions {
  readonly sampleRateHz?: number;
  readonly channels?: number;
  readonly maxDurationMs?: number;
  readonly signal?: AbortSignal;
}

export interface AudioCaptureResult {
  readonly audio: AudioInput;
}

export type AudioInputErrorCode =
  | 'MICROPHONE_PERMISSION_REQUIRED'
  | 'AUDIO_CAPTURE_FAILED'
  | 'VOICE_INPUT_UNAVAILABLE'
  | 'VOICE_CANCELLED';
