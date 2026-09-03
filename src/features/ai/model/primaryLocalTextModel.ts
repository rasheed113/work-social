import type { AiModel } from './modelContracts';

export const PRIMARY_LOCAL_TEXT_MODEL: AiModel = {
  id: 'qwen2.5-0.5b-instruct-q4_k_m',
  name: 'Qwen2.5 0.5B Instruct Q4_K_M',
  version: 'main-6dd44a1',
  type: 'TEXT',
  format: 'GGUF',
  sizeBytes: 491400032,
  sha256: '74a4da8c9fdbcd15bd1f6d01d621410d31d6fc00986f5eb687824e7b93d7a9db',
  architectureRequirements: { supportedArchitectures: ['arm64-v8a', 'arm64', 'arm', 'x86_64', 'x86', 'amd64'] },
  memoryRequirements: { requiredRamBytes: 2 * 1024 ** 3 },
  storageRequirements: { requiredFreeStorageBytes: 700 * 1024 ** 2 },
  platformRequirements: { requiredPlatform: 'any' },
  downloadSource: { kind: 'external', uri: '/api/ai-model/qwen2.5-0.5b-instruct-q4_k_m.gguf' },
  availability: 'AVAILABLE',
  status: 'NOT_INSTALLED',
};
