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

export interface ApiPaymentType {
  id: string;
  name: string;
  unitId?: string | null;
  unit?: ApiUnit | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiLaborProfile {
  id: string;
  name: string;
  categoryId: string;
  paymentTypeId: string;
  defaultRate?: number | string | null;
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

export type ApiBillType = "CASH" | "CREDIT";
export type ApiBillStatus = "DRAFT" | "CONFIRMED";

export interface ApiBillLine {
  id: string;
  billId: string;
  articleId: string;
  quantity: number | string;
  price: number | string;
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
  createdAt: string;
  updatedAt: string;
  lines: ApiBillLine[];
  party?: ApiParty | null;
}

export type ApiPaymentMethod = "CASH" | "CREDIT" | "BANK";

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

export interface ApiExpenseCategory {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export type ApiExpenseModule =
  | "CHEMICAL"
  | "REXINE"
  | "MATERIAL"
  | "LABOR"
  | "MISC";

export interface ApiExpenseEntry {
  id: string;
  date: string;
  categoryId: string;
  partyId?: string | null;
  laborId?: string | null;
  module: ApiExpenseModule;
  amount: number | string;
  description?: string | null;
  chemicalPurchaseId?: string | null;
  rexinePurchaseId?: string | null;
  materialPurchaseId?: string | null;
  laborAdvanceId?: string | null;
  createdAt: string;
  category?: ApiExpenseCategory | null;
  party?: ApiParty | null;
  laborAdvance?: ApiLaborAdvance | null;
}

export type ApiPartyType = "CUSTOMER" | "SUPPLIER" | "BOTH";

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
  debit: number | string;
  credit: number | string;
  runningBalance?: number | string | null;
  createdAt: string;
}

export interface ApiPartyPayment {
  id: string;
  partyId: string;
  date: string;
  amount: number | string;
  method: "CASH" | "CREDIT" | "BANK";
  reference?: string | null;
  description?: string | null;
  billId?: string | null;
  chemicalPurchaseId?: string | null;
  rexinePurchaseId?: string | null;
  materialPurchaseId?: string | null;
  createdAt: string;
}
