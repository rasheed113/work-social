export const ACTION_STATUSES = ['pending', 'confirmed', 'executing', 'succeeded', 'failed', 'cancelled', 'expired'] as const;
export const VERIFICATION_STATES = ['pending', 'verified', 'failed'] as const;

export type ActionStatus = typeof ACTION_STATUSES[number];
export type VerificationState = typeof VERIFICATION_STATES[number];
export type HandsModule = 'work' | 'diary' | 'work_finance' | 'finance';
export type HandsOperation = 'create' | 'update' | 'delete' | 'restore';

export interface ActionPlanStep {
  step_id: string;
  module: HandsModule;
  operation: HandsOperation;
  target: Record<string, unknown>;
  before_state: Record<string, unknown> | null;
  intended_state: Record<string, unknown> | null;
}

export interface ActionPlan {
  action_id: string;
  user_id: string;
  steps: ActionPlanStep[];
  requires_confirmation: boolean;
  reversible: boolean;
}

export function buildActionPlan(actionId: string, userId: string, steps: ActionPlanStep[]): ActionPlan {
  if (!actionId || !userId || !steps.length) throw new Error('Invalid action plan.');
  if (steps.some((step) => !step.step_id || !step.module || !step.operation)) throw new Error('Invalid action plan step.');
  return {
    action_id: actionId,
    user_id: userId,
    steps,
    requires_confirmation: true,
    reversible: steps.every((step) => step.operation === 'create' || step.before_state !== null),
  };
}

export function resolveUnique<T>(candidates: T[], label: string): T {
  if (candidates.length === 0) throw new Error(`No matching ${label} was found.`);
  if (candidates.length > 1) throw new Error(`Multiple ${label} records match.`);
  return candidates[0];
}
