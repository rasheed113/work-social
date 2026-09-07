import assert from 'node:assert/strict';
import { ACTION_STATUSES, VERIFICATION_STATES, buildActionPlan, resolveUnique } from './hands.ts';

assert.deepEqual(ACTION_STATUSES, ['pending', 'confirmed', 'executing', 'succeeded', 'failed', 'cancelled', 'expired']);
assert.deepEqual(VERIFICATION_STATES, ['pending', 'verified', 'failed']);

const plan = buildActionPlan('action-1', 'user-1', [{
  step_id: 'step-1',
  module: 'work',
  operation: 'update',
  target: { item_name: 'Shirt' },
  before_state: { id: 'record-1', quantity: 10 },
  intended_state: { quantity: 12 },
}]);
assert.equal(plan.requires_confirmation, true);
assert.equal(plan.reversible, true);
assert.equal(resolveUnique([{ id: 1 }], 'Work Entry').id, 1);
assert.throws(() => resolveUnique([], 'Work Entry'), /No matching/);
assert.throws(() => resolveUnique([{ id: 1 }, { id: 2 }], 'Work Entry'), /Multiple/);

console.log('Hands contract tests passed.');
