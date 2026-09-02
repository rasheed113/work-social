import type { AiAttachment } from '../providers/contracts';
import { OFFLINE_VISION_LIMITS, SUPPORTED_VISION_IMAGE_MIME_TYPES, VisionValidationError, isSupportedVisionImageMimeType, type ImageDimensions, type ValidatedVisionImage } from './contracts';

const MAX_IMAGE_DIMENSION = 16_384;

export async function validateVisionImages(attachments: AiAttachment[]): Promise<ValidatedVisionImage[]> {
  if (!Array.isArray(attachments) || attachments.length === 0) throw new VisionValidationError('INVALID_IMAGE_METADATA', 'At least one image attachment is required.');
  if (attachments.length > OFFLINE_VISION_LIMITS.maxImages) throw new VisionValidationError('IMAGE_COUNT_EXCEEDED', `A maximum of ${OFFLINE_VISION_LIMITS.maxImages} images is supported.`);
  const validated: ValidatedVisionImage[] = [];
  for (const attachment of attachments) validated.push(await validateVisionImage(attachment));
  return validated;
}

export async function validateVisionImage(attachment: AiAttachment): Promise<ValidatedVisionImage> {
  if (!attachment || attachment.kind !== 'image' || typeof attachment.mimeType !== 'string' || attachment.mimeType.length === 0) throw new VisionValidationError('INVALID_IMAGE_METADATA', 'Image attachment metadata is malformed.', attachment?.id);
  if (!isSupportedVisionImageMimeType(attachment.mimeType)) throw new VisionValidationError('UNSUPPORTED_IMAGE_TYPE', `Unsupported image type: ${attachment.mimeType}. Supported types: ${SUPPORTED_VISION_IMAGE_MIME_TYPES.join(', ')}.`, attachment.id);
  if (attachment.name !== undefined && (!isSafeFilename(attachment.name) || attachment.name.length > OFFLINE_VISION_LIMITS.maxFilenameLength)) throw new VisionValidationError('INVALID_IMAGE_METADATA', 'Image filename is invalid or exceeds the supported length.', attachment.id);
  const reference = resolveReference(attachment);
  if (!reference || reference.length > OFFLINE_VISION_LIMITS.maxReferenceLength || /[\u0000-\u001f\u007f]/.test(reference)) throw new VisionValidationError('INVALID_IMAGE_METADATA', 'Image attachment reference is missing or invalid.', attachment.id);
  const metadataSize = readDeclaredSize(attachment.metadata);
  const byteSize = attachment.data?.size;
  if (metadataSize !== null && (!Number.isSafeInteger(metadataSize) || metadataSize < 0)) throw new VisionValidationError('INVALID_IMAGE_METADATA', 'Declared image byte size is invalid.', attachment.id);
  if (metadataSize !== null && byteSize !== undefined && metadataSize !== byteSize) throw new VisionValidationError('INVALID_IMAGE_METADATA', 'Declared image byte size does not match the available image bytes.', attachment.id);
  const declaredSizeBytes = metadataSize ?? (byteSize ?? null);
  if (declaredSizeBytes !== null && declaredSizeBytes > OFFLINE_VISION_LIMITS.maxImageBytes) throw new VisionValidationError('IMAGE_TOO_LARGE', `Image exceeds the ${OFFLINE_VISION_LIMITS.maxImageBytes}-byte limit.`, attachment.id);
  let dimensions: ImageDimensions = { width: null, height: null, verifiedFromBytes: false };
  if (attachment.data) {
    if (!Number.isSafeInteger(attachment.data.size) || attachment.data.size > OFFLINE_VISION_LIMITS.maxImageBytes) throw new VisionValidationError('IMAGE_TOO_LARGE', `Image exceeds the ${OFFLINE_VISION_LIMITS.maxImageBytes}-byte limit.`, attachment.id);
    const bytes = new Uint8Array(await attachment.data.arrayBuffer());
    if (bytes.length !== attachment.data.size) throw new VisionValidationError('INVALID_IMAGE_METADATA', 'Available image bytes are inconsistent with the Blob size.', attachment.id);
    dimensions = readImageDimensions(attachment.mimeType, bytes);
    if (!dimensions.verifiedFromBytes) throw new VisionValidationError('INVALID_IMAGE_METADATA', 'Available image bytes could not be validated for dimensions.', attachment.id);
  }
  return { attachment, reference, declaredSizeBytes, dimensions };
}
function readDeclaredSize(metadata: Record<string, unknown> | undefined): number | null { if (!metadata) return null; const value = metadata.declaredSizeBytes ?? metadata.size; if (value === undefined) return null; return typeof value === 'number' ? value : Number.NaN; }
function resolveReference(attachment: AiAttachment): string | null {
  if (typeof attachment.id === 'string' && attachment.id.length > 0) return isSafeOpaqueReference(attachment.id) ? attachment.id : null;
  if (typeof attachment.url === 'string' && attachment.url.length > 0) return isSafeBrowserObjectUrl(attachment.url) ? attachment.url : null;
  const reference = attachment.metadata?.reference;
  if (typeof reference !== 'string' || reference.length === 0) return null;
  return isSafeBrowserObjectUrl(reference) || isSafeOpaqueReference(reference) ? reference : null;
}
function isSafeFilename(filename: string): boolean {
  if (filename.length === 0 || /[\u0000-\u001f\u007f\\/]/.test(filename)) return false;
  try { return !/(?:^|[\\/])\.\.(?:[\\/]|$)/.test(decodeURIComponent(filename)); } catch { return false; }
}
function isSafeOpaqueReference(reference: string): boolean {
  if (reference.length === 0 || /[\u0000-\u001f\u007f\\/]/.test(reference) || reference.includes(':')) return false;
  try { const decoded = decodeURIComponent(reference); return !/(?:^|[\\/])\.\.(?:[\\/]|$)/.test(decoded) && !/[\\/]/.test(decoded); } catch { return false; }
}
function isSafeBrowserObjectUrl(reference: string): boolean { try { const parsed = new URL(reference); return parsed.protocol === 'blob:' && parsed.pathname.length > 1; } catch { return false; } }
function readImageDimensions(mimeType: string, bytes: Uint8Array): ImageDimensions { try { if (mimeType === 'image/png') return readPngDimensions(bytes); if (mimeType === 'image/jpeg') return readJpegDimensions(bytes); if (mimeType === 'image/webp') return readWebpDimensions(bytes); } catch { return { width: null, height: null, verifiedFromBytes: false }; } return { width: null, height: null, verifiedFromBytes: false }; }
function dimensions(width: number, height: number): ImageDimensions { if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0 || width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) return { width: null, height: null, verifiedFromBytes: false }; return { width, height, verifiedFromBytes: true }; }
function readPngDimensions(bytes: Uint8Array): ImageDimensions { if (bytes.length < 24 || bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47 || bytes[4] !== 0x0d || bytes[5] !== 0x0a || bytes[6] !== 0x1a || bytes[7] !== 0x0a) return { width: null, height: null, verifiedFromBytes: false }; const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); if (view.getUint32(8, false) !== 13 || ascii(bytes, 12, 4) !== 'IHDR') return { width: null, height: null, verifiedFromBytes: false }; return dimensions(view.getUint32(16, false), view.getUint32(20, false)); }
function readJpegDimensions(bytes: Uint8Array): ImageDimensions { if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return { width: null, height: null, verifiedFromBytes: false }; let offset = 2; while (offset + 3 < bytes.length) { if (bytes[offset] !== 0xff) { offset += 1; continue; } while (offset < bytes.length && bytes[offset] === 0xff) offset += 1; if (offset >= bytes.length) return { width: null, height: null, verifiedFromBytes: false }; const marker = bytes[offset++]; if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue; if (offset + 1 >= bytes.length) return { width: null, height: null, verifiedFromBytes: false }; const length = (bytes[offset] << 8) | bytes[offset + 1]; if (length < 2 || offset + length > bytes.length) return { width: null, height: null, verifiedFromBytes: false }; const isSof = (marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf); if (isSof && length >= 7) return dimensions((bytes[offset + 5] << 8) | bytes[offset + 6], (bytes[offset + 3] << 8) | bytes[offset + 4]); offset += length; } return { width: null, height: null, verifiedFromBytes: false }; }
function readWebpDimensions(bytes: Uint8Array): ImageDimensions { if (bytes.length < 16 || ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WEBP') return { width: null, height: null, verifiedFromBytes: false }; const chunk = ascii(bytes, 12, 4); if (chunk === 'VP8X' && bytes.length >= 30) return dimensions(1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16), 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16)); if (chunk === 'VP8L' && bytes.length >= 25 && bytes[20] === 0x2f) return dimensions(1 + bytes[21] + ((bytes[22] & 0x3f) << 8), 1 + ((bytes[22] >> 6) & 0x03) + (bytes[23] << 2) + ((bytes[24] & 0x0f) << 10)); if (chunk === 'VP8 ' && bytes.length >= 30 && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) return dimensions(bytes[26] | ((bytes[27] & 0x3f) << 8), bytes[28] | ((bytes[29] & 0x3f) << 8)); return { width: null, height: null, verifiedFromBytes: false }; }
function ascii(bytes: Uint8Array, offset: number, length: number): string { return String.fromCharCode(...bytes.slice(offset, offset + length)); }
