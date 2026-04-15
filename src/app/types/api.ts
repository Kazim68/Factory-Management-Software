export interface ApiUnit {
  id: string;
  name: string;
  symbol?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiArticle {
  id: string;
  name: string;
  code?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiLaborCategory {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export type ApiLaborDepartment =
  | "PRESSMAN"
  | "UPPERMAN"
  | "PRINTING"
  | "DC"
  | "MACHINEMAN"
  | "PACKING";

export interface ApiPaymentType {
  id: string;
  name: string;
  unitId?: string | null;
  unit?: ApiUnit | null;
  createdAt: string;
  updatedAt: string;
}

export type ApiLaborStatus = "ACTIVE" | "FIRED";

export interface ApiLaborProfile {
  id: string;
  name: string;
  categoryId: string;
  department?: ApiLaborDepartment;
  paymentTypeId: string;
  defaultRate?: number | string | null;
  status: ApiLaborStatus;
  createdAt: string;
  updatedAt: string;
  category?: ApiLaborCategory | null;
  paymentType?: ApiPaymentType | null;
}

export interface ApiLaborWorkEntry {
  id: string;
  laborId: string;
  articleId: string;
  unitId?: string | null;
  startDate: string;
  endDate: string;
  quantity: number | string;
  rate: number | string;
  total: number | string;
  createdAt: string;
}

export interface ApiLaborAdvance {
  id: string;
  laborId: string;
  date: string;
  amount: number | string;
  reason?: string | null;
  createdAt: string;
  labor?: ApiLaborProfile | null;
}

export interface ApiLaborLedger {
  workEntries: ApiLaborWorkEntry[];
  advances: ApiLaborAdvance[];
  totalEarnings: number;
  totalAdvances: number;
  netPayable: number;
}

export type ApiBillType = "CASH" | "RECEIVABLE";
export type ApiBillStatus = "DRAFT" | "CONFIRMED";
export type ApiBillPaymentStatus = "PAID" | "UNPAID" | "PARTIAL_PAID";

export interface ApiBillLine {
  id: string;
  billId: string;
  articleId: string;
  size?: string | null;
  quantity: number | string;
  price: number | string;
  discount: number | string;
  total: number | string;
  article?: ApiArticle | null;
}

export interface ApiBill {
  id: string;
  billNumber: string;
  date: string;
  partyId?: string | null;
  type: ApiBillType;
  status: ApiBillStatus;
  total: number | string;
  totalPaid: number;
  remaining: number;
  paymentStatus: ApiBillPaymentStatus;
  isVerified: boolean;
  verifiedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  lines: ApiBillLine[];
  payments?: ApiPartyPayment[];
  party?: ApiParty | null;
}

export interface ApiBillLedgerEntry {
  id: string;
  date: string;
  reference?: string | null;
  description?: string | null;
  amount: number;
  kind: "RECEIVABLE" | "PAYMENT";
  method?: "CASH" | "KHATA" | "CREDIT" | "BANK" | "CHEQUE";
}

export type ApiPaymentMethod = "CASH" | "KHATA" | "CREDIT" | "BANK" | "CHEQUE";

export type ApiChequeStatus = "AVAILABLE" | "USED" | "CASHED";

export interface ApiCheque {
  id: string;
  date: string;
  amount: number;
  chequeNumber?: string | null;
  notes?: string | null;
  status: ApiChequeStatus;
  originType: "CUSTOMER" | "OWN";
  sourcePartyId?: string | null;
  usedPartyId?: string | null;
  sourcePaymentId?: string | null;
  usedPaymentId?: string | null;
  cashedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  sourceParty?: ApiParty | null;
  usedParty?: ApiParty | null;
}

export interface ApiChemicalPurchase {
  id: string;
  date: string;
  partyId?: string | null;
  quantityKg: number | string;
  ratePerKg: number | string;
  totalAmount: number | string;
  paymentType: ApiPaymentMethod;
  createdAt: string;
  party?: ApiParty | null;
  expenses?: ApiExpenseEntry[];
}

export interface ApiRexinePurchase {
  id: string;
  date: string;
  partyId?: string | null;
  quantityMeter: number | string;
  ratePerMeter: number | string;
  totalAmount: number | string;
  paymentType: ApiPaymentMethod;
  createdAt: string;
  party?: ApiParty | null;
  expenses?: ApiExpenseEntry[];
}

export interface ApiMaterialPurchase {
  id: string;
  date: string;
  partyId?: string | null;
  articleId?: string | null;
  unitId?: string | null;
  quantity: number | string;
  pricePerUnit: number | string;
  totalAmount: number | string;
  paymentType: ApiPaymentMethod;
  createdAt: string;
  party?: ApiParty | null;
  article?: ApiArticle | null;
  unit?: ApiUnit | null;
  expenses?: ApiExpenseEntry[];
}

export type ApiExpenseModule =
  | "CHEMICAL"
  | "REXINE"
  | "MATERIAL"
  | "LABOR"
  | "MISC";

export type ApiExpenseSource = "MANUAL" | "SYSTEM";

export interface ApiExpenseEntry {
  id: string;
  date: string;
  partyId?: string | null;
  laborId?: string | null;
  module: ApiExpenseModule;
  paymentType?: ApiPaymentMethod;
  amount: number | string;
  description?: string | null;
  chemicalPurchaseId?: string | null;
  rexinePurchaseId?: string | null;
  materialPurchaseId?: string | null;
  laborAdvanceId?: string | null;
  source?: ApiExpenseSource;
  sourceSystem?: string | null;
  createdAt: string;
  party?: ApiParty | null;
  labor?: ApiLaborProfile | null;
  laborAdvance?: ApiLaborAdvance | null;
}

export type ApiPartyType = "CUSTOMER" | "SUPPLIER";

export interface ApiParty {
  id: string;
  name: string;
  type: ApiPartyType;
  openingBalance: number | string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiPartyLedgerEntry {
  id: string;
  partyId: string;
  date: string;
  reference?: string | null;
  description?: string | null;
  balance: number | string;
  payable: number | string;
  receivable: number | string;
  cash?: number | string;
  isCash?: boolean;
  runningBalance?: number | string | null;
  createdAt: string;
}

export interface ApiPartyPayment {
  id: string;
  partyId: string;
  date: string;
  amount: number | string;
  method: "CASH" | "KHATA" | "CREDIT" | "BANK" | "CHEQUE";
  direction?: "RECEIVE" | "PAY";
  reference?: string | null;
  description?: string | null;
  billId?: string | null;
  chemicalPurchaseId?: string | null;
  rexinePurchaseId?: string | null;
  materialPurchaseId?: string | null;
  createdAt: string;
}

export interface ApiSupplierPendingDue {
  partyId: string;
  partyName: string;
  partyType: Extract<ApiPartyType, "SUPPLIER">;
  netBalance: number;
  remainingDue: number;
}

export interface ApiSupplierPendingDuesResponse {
  asOf: string;
  totalPending: number;
  pending: ApiSupplierPendingDue[];
}

export type ApiProductionStage =
  | "STAGE_PRESSMAN"
  | "STAGE_UPPERMAN"
  | "STAGE_PRINTING"
  | "STAGE_DC"
  | "STAGE_MACHINEMAN"
  | "STAGE_PACKING";

export type ApiProductionOrderSource =
  | "MANUAL"
  | "PRESSMAN_FLOW"
  | "UPPER_PRINT_PARALLEL"
  | "STAGE_FLOW";

export type ApiProductionOrderStatus =
  | "INCOMPLETE"
  | "PARTIALLY_COMPLETE"
  | "COMPLETE";

export interface ApiProductionOrder {
  id: string;
  department: ApiLaborDepartment;
  departmentLabel: string;
  stage: ApiProductionStage;
  articleId: string;
  size: string;
  laborId?: string | null;
  packingLaborId?: string | null;
  quantityDozen: number;
  pricePerDozen: number;
  packingPricePerDozen: number;
  completedDozen: number;
  bMallDozen: number;
  cMallDozen: number;
  forwardedDozen: number;
  source: ApiProductionOrderSource;
  isClosed: boolean;
  createdAt: string;
  updatedAt: string;
  closedAt?: string | null;
  orderDate: string;
  status: ApiProductionOrderStatus;
  article?: ApiArticle | null;
  labor?: ApiLaborProfile | null;
  packingLabor?: ApiLaborProfile | null;
}

export type ApiStockMode = "IN_STOCK" | "PACKED";
export type ApiMallStockType = "B_MALL" | "C_MALL";
export type ApiStockMovementDirection = "IN" | "OUT";

export interface ApiStockEntry {
  id: string;
  articleId: string;
  mode: ApiStockMode;
  quantityDozen: number;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
  article?: ApiArticle | null;
}

export interface ApiStockSummary {
  activeOrders: number;
  wipDozen: number;
  readyStockDozen: number;
  packedStockDozen: number;
  packedAMallDozen: number;
  packedBMallDozen: number;
  packedCMallDozen: number;
}

export interface ApiStockArticleRow {
  articleId: string;
  articleName: string;
  size: string;
  articleCode?: string | null;
  quantityDozen: number;
  bMallDozen: number;
  cMallDozen: number;
}

export interface ApiMallStockMovement {
  id: string;
  mallType: ApiMallStockType;
  direction: ApiStockMovementDirection;
  date: string;
  quantityDozen: number;
  ratePerDozen?: number | null;
  totalAmount?: number | null;
  reference?: string | null;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ApiReportPeriod = "daily" | "weekly" | "monthly";

export interface ApiRoznamchaReportBucket {
  key: string;
  totalInflow: number;
  totalOutflow: number;
  netCashFlow: number;
  entryCount: number;
  moduleBreakdown: Record<string, number>;
}

export interface ApiRoznamchaSummaryReport {
  report: "roznamcha-summary";
  period: ApiReportPeriod;
  range: {
    start: string;
    end: string;
  };
  totals: {
    totalInflow: number;
    totalOutflow: number;
    netCashFlow: number;
    entryCount: number;
  };
  buckets: ApiRoznamchaReportBucket[];
}

export interface ApiLaborSummaryRow {
  laborId: string;
  laborName: string;
  totalEarnings: number;
  totalAdvances: number;
  totalPaidCash: number;
  netPayable: number;
}

export interface ApiLaborSummaryBucket {
  key: string;
  totalEarnings: number;
  totalAdvances: number;
  totalPaidCash: number;
  netPayable: number;
  laborCount: number;
  labors: ApiLaborSummaryRow[];
}

export interface ApiLaborSummaryReport {
  report: "labor-summary";
  period: Extract<ApiReportPeriod, "weekly" | "monthly">;
  range: {
    start: string;
    end: string;
  };
  totals: {
    totalEarnings: number;
    totalAdvances: number;
    totalPaidCash: number;
    netPayable: number;
  };
  counts: {
    workEntries: number;
    advances: number;
    payments: number;
    uniqueLabors: number;
  };
  buckets: ApiLaborSummaryBucket[];
}

export interface ApiPartyMonthlyOutstandingRow {
  partyId: string;
  partyName: string;
  partyType: ApiPartyType;
  outstanding: number;
  receivable: number;
  payable: number;
}

export interface ApiPartyMonthlyOutstandingBucket {
  key: string;
  partyCount: number;
  totalOutstanding: number;
  totalReceivable: number;
  totalPayable: number;
  parties: ApiPartyMonthlyOutstandingRow[];
}

export interface ApiPartyMonthlyOutstandingReport {
  report: "party-monthly-outstanding";
  period: Extract<ApiReportPeriod, "monthly">;
  range: {
    start: string;
    end: string;
  };
  totals: {
    totalOutstanding: number;
    totalReceivable: number;
    totalPayable: number;
  };
  counts: {
    parties: number;
    ledgerEntries: number;
    activeOutstandingParties: number;
  };
  buckets: ApiPartyMonthlyOutstandingBucket[];
}
