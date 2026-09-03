import type { AiAttachment, AiMessage, AiRequestModality } from '../providers/contracts';
import type { AiModel } from '../model/modelContracts';
import type { LocalAiDiagnostic } from './localAiDiagnostics';

export interface LocalInferenceCapabilities { textGeneration: boolean; visionInput: boolean; multimodalInput: boolean; streaming: boolean; cancellation: boolean; }
export const BROWSER_LOCAL_INFERENCE_CAPABILITIES: LocalInferenceCapabilities = Object.freeze({ textGeneration: false, visionInput: false, multimodalInput: false, streaming: false, cancellation: false });
export type LocalInferenceRuntimeStatus = 'UNAVAILABLE' | 'UNINITIALIZED' | 'INITIALIZING' | 'READY' | 'LOADING_MODEL' | 'MODEL_READY' | 'GENERATING' | 'CANCELLING' | 'ERROR' | 'DISPOSED';
export type InferenceFinishReason = 'STOP' | 'LENGTH' | 'CANCELLED' | 'ERROR';
export interface InferenceRequest { messages: AiMessage[]; modality?: AiRequestModality; attachments?: AiAttachment[]; maxTokens?: number; temperature?: number; topP?: number; contextSize?: number; stopSequences?: string[]; signal?: AbortSignal; diagnosticRequestId?: string; }
export interface InferenceUsage { promptTokens: number | null; completionTokens: number | null; totalTokens: number | null; }
export interface InferenceRuntimeMetadata { provider: 'local'; runtime: string; modelId: string; modelVersion: string; }
export interface InferenceResponse { text: string; finishReason: InferenceFinishReason; usage: InferenceUsage; runtimeMetadata: InferenceRuntimeMetadata; }
export type InferenceStreamEvent = { type: 'TOKEN'; text: string } | { type: 'COMPLETE'; response: InferenceResponse } | { type: 'ERROR'; error: Error };
export const verifiedModelReferenceBrand: unique symbol = Symbol('verified-local-model-reference');
export interface VerifiedLocalModelReference { readonly model: Readonly<AiModel>; readonly [verifiedModelReferenceBrand]: true; readVerifiedModel(): Promise<Blob>; }
export interface LocalInferenceRuntime { initialize(): Promise<void>; loadModel(model: VerifiedLocalModelReference): Promise<void>; unloadModel(): Promise<void>; generate(request: InferenceRequest): Promise<InferenceResponse>; stream(request: InferenceRequest): AsyncIterable<InferenceStreamEvent>; cancel(): Promise<void>; getStatus(): LocalInferenceRuntimeStatus; getCapabilities?(): LocalInferenceCapabilities; dispose(): Promise<void>; }
export interface LocalInferenceEngineAdapter { readonly name: string; readonly streaming: boolean; readonly cancellation: boolean; readonly capabilities?: Partial<LocalInferenceCapabilities>; initialize(): Promise<void>; loadModel(model: VerifiedLocalModelReference): Promise<void>; unloadModel(): Promise<void>; generate(request: InferenceRequest, signal: AbortSignal): Promise<InferenceResponse>; stream(request: InferenceRequest, signal: AbortSignal): AsyncIterable<InferenceStreamEvent>; cancel(): Promise<void>; dispose(): Promise<void>; }
export type LocalInferenceErrorCode = 'OFFLINE_TEXT_AI_UNAVAILABLE' | 'MODEL_NOT_INSTALLED' | 'MODEL_INVALID' | 'MODEL_INCOMPATIBLE' | 'MODEL_DOWNLOAD_FAILED' | 'MODEL_DOWNLOAD_HTTP_FAILED' | 'MODEL_DOWNLOAD_FETCH_FAILED' | 'MODEL_DOWNLOAD_RESPONSE_READ_FAILED' | 'MODEL_DOWNLOAD_ABORTED' | 'MODEL_DOWNLOAD_INCOMPLETE' | 'MODEL_DOWNLOAD_CHECKSUM_FAILED' | 'MODEL_IMPORT_ABORTED' | 'WLLAMA_WASM_FETCH_FAILED' | 'WLLAMA_COMPAT_WASM_FETCH_FAILED' | 'WLLAMA_WORKER_ASSET_FAILED' | 'MODEL_STORAGE_READ_FAILED' | 'MODEL_STORAGE_WRITE_FAILED' | 'RUNTIME_INITIALIZATION_FAILED' | 'RUNTIME_UNAVAILABLE' | 'MODEL_LOAD_FAILED' | 'INFERENCE_FAILED' | 'INFERENCE_CANCELLED' | 'OFFLINE_GENERATION_TIMEOUT' | 'CONTEXT_TOO_LARGE' | 'INSUFFICIENT_RESOURCES' | 'UNSUPPORTED_ATTACHMENT' | 'INVALID_STATE' | 'INVALID_MODEL_REFERENCE' | 'MODEL_NOT_READY' | 'VISION_NOT_SUPPORTED' | 'VISION_RUNTIME_UNAVAILABLE' | 'UNSUPPORTED_IMAGE_TYPE' | 'IMAGE_TOO_LARGE' | 'IMAGE_COUNT_EXCEEDED' | 'INVALID_IMAGE_METADATA';
export class LocalInferenceRuntimeError extends Error {
  constructor(readonly code: LocalInferenceErrorCode, message: string, readonly diagnostic?: LocalAiDiagnostic) { super(message); this.name = 'LocalInferenceRuntimeError'; }
}
