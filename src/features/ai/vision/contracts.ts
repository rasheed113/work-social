import type { AiAttachment, AiGenerationOptions, AiMessage, AiRequestModality } from '../providers/contracts';

export const SUPPORTED_VISION_IMAGE_MIME_TYPES = Object.freeze([
  'image/jpeg',
  'image/png',
  'image/webp',
] as const);

export const OFFLINE_VISION_LIMITS = Object.freeze({
  maxImages: 8,
  maxImageBytes: 25 * 1024 * 1024,
  maxFilenameLength: 255,
  maxReferenceLength: 2_048,
});

export type VisionValidationErrorCode =
  | 'UNSUPPORTED_IMAGE_TYPE'
  | 'IMAGE_TOO_LARGE'
  | 'IMAGE_COUNT_EXCEEDED'
  | 'INVALID_IMAGE_METADATA';

export interface ImageDimensions {
  width: number | null;
  height: number | null;
  verifiedFromBytes: boolean;
}

export interface ValidatedVisionImage {
  attachment: AiAttachment;
  reference: string;
  declaredSizeBytes: number | null;
  dimensions: ImageDimensions;
}

export interface AiVisionRequest {
  prompt: string;
  images: AiAttachment[];
  context?: AiMessage[];
  options?: AiGenerationOptions;
  modality?: Extract<AiRequestModality, 'VISION' | 'MULTIMODAL'>;
}

export class VisionValidationError extends Error {
  constructor(
    readonly code: VisionValidationErrorCode,
    message: string,
    readonly attachmentId?: string,
  ) {
    super(message);
    this.name = 'VisionValidationError';
  }
}

export function isSupportedVisionImageMimeType(mimeType: string): boolean {
  return (SUPPORTED_VISION_IMAGE_MIME_TYPES as readonly string[]).includes(mimeType);
}
