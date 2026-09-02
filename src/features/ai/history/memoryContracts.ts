export interface AiMemory {
  id: string;
  key: string;
  value: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiMemoryStore {
  list(): Promise<AiMemory[]>;
  get(id: string): Promise<AiMemory | null>;
  upsert(memory: AiMemory): Promise<AiMemory>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
}

export const AI_MEMORY_LIMITS = Object.freeze({
  maxMemories: 50,
  maxIdLength: 200,
  maxKeyLength: 128,
  maxValueLength: 512,
});

export type AiMemoryErrorCode =
  | 'INVALID_RECORD'
  | 'INVALID_ARGUMENT'
  | 'LIMIT_EXCEEDED'
  | 'MEMORY_NOT_FOUND'
  | 'SECRET_NOT_ALLOWED'
  | 'STORAGE_UNAVAILABLE'
  | 'STORAGE_FAILED';

export class AiMemoryError extends Error {
  constructor(
    readonly code: AiMemoryErrorCode,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AiMemoryError';
  }
}
