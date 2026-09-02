import type { AiModel } from './modelContracts';

const GIB = 1024 ** 3;

/** Planning metadata only. No model binary or trusted checksum is included. */
export const PRIMARY_LOCAL_TEXT_MODEL: AiModel = {
  id: 'local-text-3b-4b-primary',
  name: 'Work Social Local Text 3B–4B Planning Target',
  version: 'planning-1',
  type: 'TEXT',
  format: 'GGUF',
  sizeBytes: 2.5 * GIB,
  sha256: null,
  architectureRequirements: {
    supportedArchitectures: ['arm64-v8a'],
  },
  memoryRequirements: {
    requiredRamBytes: 4 * GIB,
  },
  storageRequirements: {
    requiredFreeStorageBytes: 2.5 * GIB,
  },
  platformRequirements: {
    requiredPlatform: 'android',
    minimumAndroidVersion: 26,
  },
  downloadSource: null,
  availability: 'UNKNOWN',
  status: 'NOT_INSTALLED',
};
