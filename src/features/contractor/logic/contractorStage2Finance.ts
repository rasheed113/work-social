export type ContractorStage2FinanceTotals = {
  totalPayable: number;
  totalCommission: number;
  totalReceived: number;
};

export type ContractorStage2FinanceResult = ContractorStage2FinanceTotals & {
  paidAgainstPayable: number;
  due: number;
  advancePaid: number;
  paymentCoverage: number;
};

export function calculateContractorStage2Finance(
  totals: ContractorStage2FinanceTotals,
): ContractorStage2FinanceResult {
  const totalPayable = Math.max(0, totals.totalPayable);
  const totalCommission = Math.max(0, totals.totalCommission);
  const totalReceived = Math.max(0, totals.totalReceived);
  const paidAgainstPayable = Math.min(totalReceived, totalPayable);
  const due = Math.max(totalPayable - totalReceived, 0);
  const advancePaid = Math.max(totalReceived - totalPayable, 0);
  const paymentCoverage = totalPayable > 0
    ? Math.min(totalReceived / totalPayable, 1) * 100
    : 0;

  return {
    totalPayable,
    totalCommission,
    totalReceived,
    paidAgainstPayable,
    due,
    advancePaid,
    paymentCoverage,
  };
}
