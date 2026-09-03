import assert from 'node:assert/strict';
import { detectLocalWorkAction } from './localWorkActionIntent';

const now = '2026-09-03T17:14:00+05:00';
function expectMissing(text: string, field: 'item_name' | 'quantity' | 'rate') { const result = detectLocalWorkAction(text, now); assert.equal(result.kind, 'missing'); if (result.kind === 'missing') assert.equal(result.missing, field); }

const exact = detectLocalWorkAction('Add new entry item name shirt size S rate 34 pieces 32', now);
assert.equal(exact.kind, 'action');
if (exact.kind === 'action') { assert.equal(exact.intent.toolName, 'create_work_entry'); assert.deepEqual(exact.intent.arguments, { item_name: 'shirt', size: ['S'], quantity: '32', rate: '34', special_note: null, occurred_at_iso: now }); assert.equal(exact.total, 1088); }

const variations = detectLocalWorkAction('nayi work entry banao item shirt size S rate 34 pieces 32', now);
assert.equal(variations.kind, 'action'); if (variations.kind === 'action') assert.equal(variations.intent.arguments.item_name, 'shirt');

const urdu = detectLocalWorkAction('نئی انٹری بنائیں، شرٹ، سائز S، ریٹ 34، 32 پیس', now);
assert.equal(urdu.kind, 'action');
if (urdu.kind === 'action') { assert.equal(urdu.intent.arguments.item_name, 'شرٹ'); assert.deepEqual(urdu.intent.arguments.size, ['S']); assert.equal(urdu.intent.arguments.rate, '34'); assert.equal(urdu.intent.arguments.quantity, '32'); assert.equal(urdu.total, 1088); }

expectMissing('Add new entry item shirt size S rate 34', 'quantity');
expectMissing('Add new entry item shirt size S pieces 32', 'rate');
expectMissing('Add new entry size S rate 34 pieces 32', 'item_name');
assert.equal(detectLocalWorkAction('hello explain my work', now).kind, 'not_action');
assert.equal(detectLocalWorkAction('Add new entry item shirt rate 34 pieces 0', now).kind, 'missing');
assert.equal(detectLocalWorkAction('Add new entry item shirt rate -34 pieces 32', now).kind, 'missing');
assert.equal(detectLocalWorkAction('Add new entry item shirt rate abc pieces 32', now).kind, 'missing');
assert.equal(detectLocalWorkAction('Add new entry item shirt rate 34 pieces -2', now).kind, 'missing');
assert.equal(detectLocalWorkAction('Add new entry item shirt rate 34 pieces 32', now).kind, 'action');
console.log('localWorkActionIntent.test.ts: PASS');
