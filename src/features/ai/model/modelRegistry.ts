import type { AiModel, ModelAvailability, ModelStatus } from './modelContracts';

export interface ModelRegistry {
  listModels(): AiModel[];
  getModel(id: string): AiModel | undefined;
  registerModel(model: AiModel): AiModel;
  updateStatus(id: string, status: ModelStatus): AiModel | undefined;
  updateAvailability(id: string, availability: ModelAvailability): AiModel | undefined;
  removeModel(id: string): boolean;
}

/** In-memory catalog for model metadata. Persistence belongs to a future platform adapter. */
export class InMemoryModelRegistry implements ModelRegistry {
  private readonly models = new Map<string, AiModel>();

  listModels(): AiModel[] {
    return [...this.models.values()].map((model) => ({ ...model }));
  }

  getModel(id: string): AiModel | undefined {
    const model = this.models.get(id);
    return model ? { ...model } : undefined;
  }

  registerModel(model: AiModel): AiModel {
    if (this.models.has(model.id)) throw new Error(`Model ${model.id} is already registered.`);
    const registered = { ...model, availability: 'UNKNOWN' as const, status: 'NOT_INSTALLED' as const };
    this.models.set(model.id, registered);
    return { ...registered };
  }

  updateStatus(id: string, status: ModelStatus): AiModel | undefined {
    const model = this.models.get(id);
    if (!model) return undefined;
    const updated = { ...model, status };
    this.models.set(id, updated);
    return { ...updated };
  }

  updateAvailability(id: string, availability: ModelAvailability): AiModel | undefined {
    const model = this.models.get(id);
    if (!model) return undefined;
    const updated = { ...model, availability };
    this.models.set(id, updated);
    return { ...updated };
  }

  removeModel(id: string): boolean {
    return this.models.delete(id);
  }
}
