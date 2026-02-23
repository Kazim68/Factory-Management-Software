// Core Types for Factory Management System

export interface Party {
  id: string;
  name: string;
  type: 'customer' | 'supplier' | 'both';
  openingBalance: number;
  currentBalance: number;
  createdAt: string;
}

export interface Article {
  id: string;
  name: string;
  defaultRate?: number;
  createdAt: string;
}

export interface LaborCategory {
  id: string;
  name: string;
  paymentType: 'per_dozen' | 'per_pair' | 'per_upper' | 'monthly_salary';
  createdAt: string;
}

export interface Labor {
  id: string;
  name: string;
  categoryId: string;
  category: string;
  paymentType: 'per_dozen' | 'per_pair' | 'per_upper' | 'monthly_salary';
  monthlyRate?: number;
  articleRates: { [articleId: string]: number }; // article-wise rates
  createdAt: string;
}

export interface LaborWork {
  id: string;
  laborId: string;
  laborName: string;
  date: string;
  articleId: string;
  articleName: string;
  quantity: number;
  rate: number;
  total: number;
  createdAt: string;
  editHistory?: EditLog[];
}

export interface LaborKharcha {
  id: string;
  laborId: string;
  laborName: string;
  date: string;
  amount: number;
  reason: string;
  createdAt: string;
  editHistory?: EditLog[];
}

export interface ChemicalTransaction {
  id: string;
  date: string;
  partyId: string;
  partyName: string;
  weight: number; // kg
  rate: number;
  total: number;
  paymentType: 'cash' | 'payable';
  paymentReceived: number;
  balance: number;
  detail: string;
  createdAt: string;
  editHistory?: EditLog[];
}

export interface RexineTransaction {
  id: string;
  date: string;
  partyId: string;
  partyName: string;
  meters: number;
  rate: number;
  total: number;
  paymentType: 'cash' | 'payable';
  paymentReceived: number;
  balance: number;
  detail: string;
  createdAt: string;
  editHistory?: EditLog[];
}

export interface MaterialTransaction {
  id: string;
  date: string;
  partyId: string;
  partyName: string;
  articleId: string;
  articleName: string;
  quantity: number;
  pricePerPair: number;
  total: number;
  paymentType: 'cash' | 'payable';
  paymentReceived: number;
  balance: number;
  detail: string;
  createdAt: string;
  editHistory?: EditLog[];
}

export interface BillItem {
  articleId: string;
  articleName: string;
  quantity: number;
  price: number;
  total: number;
}

export interface Bill {
  id: string;
  billNumber: string;
  date: string;
  partyId: string;
  partyName: string;
  items: BillItem[];
  grandTotal: number;
  paymentType: 'cash' | 'receivable';
  status: 'draft' | 'confirmed';
  createdAt: string;
  editHistory?: EditLog[];
}

export interface PartyLedgerEntry {
  id: string;
  date: string;
  partyId: string;
  reference: string; // bill no / payment receipt
  description: string;
  payable: number;
  receivable: number;
  balance: number;
  type: 'bill' | 'payment' | 'chemical' | 'rexine' | 'material' | 'opening';
  createdAt: string;
}

export interface RoznamchaEntry {
  id: string;
  date: string;
  expenseType: string; // chemical, labor, misc
  partyId?: string;
  partyName?: string;
  laborId?: string;
  laborName?: string;
  amount: number;
  description: string;
  createdAt: string;
  editHistory?: EditLog[];
}

export interface ExpenseCategory {
  id: string;
  name: string;
  createdAt: string;
}

export interface EditLog {
  timestamp: string;
  user: string;
  field: string;
  oldValue: any;
  newValue: any;
}

export interface Payment {
  id: string;
  date: string;
  partyId: string;
  partyName: string;
  amount: number;
  description: string;
  createdAt: string;
}
