export type ContractorCommissionType = 'percentage' | 'per_piece';
export type ContractorCommissionMode = 'included' | 'separate';
export function calculateContractorCommission(rate:number,type:ContractorCommissionType|null,value:number|null){if(!type||value===null||!Number.isFinite(rate)||!Number.isFinite(value))return 0;return type==='percentage'?rate*(value/100):value}
export function calculateContractorActualRate(rate:number,commissionPerPiece:number,mode:ContractorCommissionMode|null){if(!mode)return rate;return mode==='included'?rate-commissionPerPiece:rate+commissionPerPiece}
export function calculateContractorTotal(pieces:number,actualRate:number){return Math.round((pieces*actualRate+Number.EPSILON)*10000)/10000}
export function roundContractorMoney(value:number){return Math.round((value+Number.EPSILON)*10000)/10000}
export function formatContractorMoney(value:number){return new Intl.NumberFormat('en-PK',{maximumFractionDigits:4}).format(value)}
