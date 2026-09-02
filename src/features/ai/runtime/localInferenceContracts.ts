import type { AiMessage } from '../providers/contracts';
import type { AiModel } from '../model/modelContracts';

export type LocalInferenceRuntimeStatus =
  | 'UNAVAILABLE' | 'UNINITIALIZED' | 'INITIALIZING' | 'READY' | 'LOADING_MODEL'
  | 'MODEL_READY' | 'GENERATING' | 'CANCELLING' | 'ERROR' | 'DISPOSED';
export type InferenceFinishReason = 'STOP' | 'LENGTH' | 'CANCELLED' | 'ERROR';

export interface InferenceRequest {
  messages: AiMessage[];
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  contextSize?: number;
  stopSequences?: string[];
  signal?: AbortSignal;
}
export interface InferenceUsage { promptTokens: number | null; completionTokens: number | null; totalTokens: number | null; }
export interface InferenceRuntimeMetadata { provider: 'local'; runtime: string; modelId: string; modelVersion: string; }
export interface InferenceResponse { text: string; finishReason: InferenceFinishReason; usage: InferenceUsage; runtimeMetadata: InferenceRuntimeMetadata; }
export type InferenceStreamEvent =
  | { type: 'TOKEN'; text: string }
  | { type: 'COMPLETE'; response: InferenceResponse }
  | { type: 'ERROR'; error: Error };

export const verifiedModelReferenceBrand: unique symbol = Symbol('verified-local-model-reference');
export interface VerifiedLocalModelReference {
  readonly model: Readonly<AiModel>;
  readonly [verifiedModelReferenceBrand]: true;
  readVerifiedModel(): Promise<Blob>;
}

export interface LocalInferenceRuntime {
  initialize(): Promise<void>;
  loadModel(model: VerifiedLocalModelReference): Promise<void>;
  unloadModel(): Promise<void>;
  generate(request: InferenceRequest): Promise<InferenceResponse>;
  stream(request: InferenceRequest): AsyncIterable<InferenceStreamEvent>;
  cancel(): Promise<void>;
  getStatus(): LocalInferenceRuntimeStatus;
  dispose(): Promise<void>;
}

/** Platform adapter boundary. No llama.cpp/native-specific API is exposed here. */
export interface LocalInferenceEngineAdapter {
  readonly name: string;
  readonly streaming: boolean;
  readonly cancellation: boolean;
  initialize(): Promise<void>;
  loadModel(model: VerifiedLocalModelReference): Promise<void>;
  unloadModel(): Promise<void>;
  generate(request: InferenceRequest, signal: AbortSignal): Promise<InferenceResponse>;
  stream(request: InferenceRequest, signal: AbortSignal): AsyncIterable<InferenceStreamEvent>;
  cancel(): Promise<void>;
  dispose(): Promise<void>;
}

export class LocalInferenceRuntimeError extends Error {
  constructor(
    readonly code: 'LOCAL_RUNTIME_UNAVAILABLE' | 'INVALID_STATE' | 'INVALID_MODEL_REFERENCE' |
      'MODEL_NOT_READY' | 'GENERATION_CANCELLED' | 'RUNTIME_ERROR',
    message: string,
  ) { super(message); this.name = 'LocalInferenceRuntimeError'; }
}
