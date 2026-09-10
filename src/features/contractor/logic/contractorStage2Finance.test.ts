import { strict as assert } from 'node:assert';
import { calculateContractorStage2Finance } from './contractorStage2Finance';

const expectFinance = (
  input: Parameters<typeof calculateContractorStage2Finance>[0],
  expected: ReturnType<typeof calculateContractorStage2Finance>,
) => assert.deepEqual(calculateContractorStage2Finance(input), expected);

expectFinance(
  { totalPayable: 230000, totalCommission: 23000, totalReceived: 235000 },
  { totalPayable: 230000, totalCommission: 23000, totalReceived: 235000, paidAgainstPayable: 230000, due: 0, advancePaid: 5000, paymentCoverage: 100 },
);

expectFinance(
  { totalPayable: 100000, totalCommission: 0, totalReceived: 25000 },
  { totalPayable: 100000, totalCommission: 0, totalReceived: 25000, paidAgainstPayable: 25000, due: 75000, advancePaid: 0, paymentCoverage: 25 },
);

expectFinance(
  { totalPayable: 100000, totalCommission: 10000, totalReceived: 100000 },
  { totalPayable: 100000, totalCommission: 10000, totalReceived: 100000, paidAgainstPayable: 100000, due: 0, advancePaid: 0, paymentCoverage: 100 },
);

expectFinance(
  { totalPayable: 0, totalCommission: 0, totalReceived: 5000 },
  { totalPayable: 0, totalCommission: 0, totalReceived: 5000, paidAgainstPayable: 0, due: 0, advancePaid: 5000, paymentCoverage: 0 },
);

expectFinance(
  { totalPayable: 100000, totalCommission: 10000, totalReceived: 0 },
  { totalPayable: 100000, totalCommission: 10000, totalReceived: 0, paidAgainstPayable: 0, due: 100000, advancePaid: 0, paymentCoverage: 0 },
);

const multiplePayments = calculateContractorStage2Finance({ totalPayable: 230000, totalCommission: 23000, totalReceived: 50000 + 80000 + 105000 });
assert.equal(multiplePayments.paidAgainstPayable, 230000);
assert.equal(multiplePayments.due, 0);
assert.equal(multiplePayments.advancePaid, 5000);
assert.equal(multiplePayments.paymentCoverage, 100);

const partial = calculateContractorStage2Finance({ totalPayable: 230000, totalCommission: 23000, totalReceived: 120000 });
assert.equal(partial.paidAgainstPayable, 120000);
assert.equal(partial.due, 110000);
assert.equal(partial.advancePaid, 0);
assert.ok(partial.paymentCoverage <= 100);

const overpayment = calculateContractorStage2Finance({ totalPayable: 230000, totalCommission: 23000, totalReceived: 400000 });
assert.equal(overpayment.paidAgainstPayable, 230000);
assert.equal(overpayment.due, 0);
assert.equal(overpayment.advancePaid, 170000);
assert.equal(overpayment.paymentCoverage, 100);

console.log('contractorStage2Finance.test.ts: PASS');
