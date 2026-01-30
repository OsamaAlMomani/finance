export type TransactionType = 'income' | 'expense' | 'transfer';
export type AccountType = 'cash' | 'bank' | 'wallet' | 'card';
export type PeriodType = 'weekly' | 'monthly' | 'yearly';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  currency: string;
  initialBalance: number;
  // Computed property, might not be in DB table directly if we sum transactions
  // But info.txt mentions "Balance Snapshot" optional.
  // We'll calculate it for now.
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  date: string; // ISO date
  category: string;
  merchant: string;
  notes?: string;
  accountId: string;
  tags?: string[]; // Stored as JSON string in DB
  attachmentPath?: string;
  taxAmount?: number;
}

export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  color?: string;
  icon?: string;
}

export interface Budget {
  id: string;
  category: string; // Linking by name or ID? Info.txt says "Pick category".
  period: PeriodType;
  limitAmount: number;
}

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  targetDate: string;
  linkedAccountId?: string;
  currentAmount?: number; // Calculated or manual contributions
}

export interface Bill {
  id: string;
  name: string;
  amount: number;
  nextDueDate: string;
  recurrence: PeriodType | 'once';
  isPaid: boolean;
  autoPay?: boolean;
}

export interface TaxRule {
  id: string;
  category: string;
  rate: number; // Percentage
  mode: 'flat' | 'included' | 'bracket';
}
