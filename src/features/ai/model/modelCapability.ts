import type { AiModelType } from './modelContracts';

export function isVisionModelCapable(type: AiModelType): boolean {
  return type === 'VISION' || type === 'MULTIMODAL';
}

export function supportsModelModality(type: AiModelType, modality: 'TEXT' | 'VISION' | 'MULTIMODAL'): boolean {
  if (modality === 'TEXT') return true;
  if (modality === 'VISION') return type === 'VISION' || type === 'MULTIMODAL';
  return type === 'MULTIMODAL';
}
