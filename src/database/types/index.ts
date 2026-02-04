/**
 * Database Types - All entity interfaces and types
 * Extracted from: src/services/database.ts
 * 
 * This is the source of truth for all database entity types
 */

// Transaction types
export interface Transaction {
  id: string;
  date: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  accountId: string;
  categoryId: string;
  merchant?: string;
  description?: string;
  tags?: string[];
  taxFlag: 'taxable' | 'deductible' | 'none' | 'unknown';
  isRecurring: boolean;
  recurringPattern?: string;
  createdAt: string;
  updatedAt: string;
}

// Account types
export interface Account {
  id: string;
  name: string;
  type: 'checking' | 'savings' | 'credit' | 'investment' | 'cash' | 'other';
  balance: number;
  currency: string;
  isActive: boolean;
  color?: string;
  createdAt: string;
  updatedAt: string;
}

// Category types
export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  color?: string;
  icon?: string;
  parentId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Budget types
export interface Budget {
  id: string;
  categoryId: string;
  accountId?: string;
  amount: number;
  period: 'monthly' | 'quarterly' | 'yearly';
  startDate: string;
  endDate?: string;
  alertThreshold: number;
  createdAt: string;
  updatedAt: string;
}

// Goal types
export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  dueDate: string;
  priority: 'low' | 'medium' | 'high';
  status: 'active' | 'completed' | 'abandoned';
  accountId?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

// Expense types
export interface Expense {
  id: string;
  transactionId: string;
  categoryId: string;
  vendor?: string;
  isRecurring: boolean;
  frequency?: string;
  createdAt: string;
  updatedAt: string;
}

// Income Source types
export interface IncomeSource {
  id: string;
  name: string;
  amount: number;
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
  nextPayDate: string;
  isActive: boolean;
  categoryId?: string;
  createdAt: string;
  updatedAt: string;
}

// Forecast types
export interface Forecast {
  id: string;
  name: string;
  type: 'balance' | 'cashflow' | 'savings' | 'goal';
  startDate: string;
  endDate: string;
  parameters: Record<string, unknown>;
  results?: Record<string, number[]>;
  createdAt: string;
  updatedAt: string;
}

// Calendar Event types
export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  type: 'bill' | 'income' | 'goal_milestone' | 'reminder' | 'other';
  amount?: number;
  accountId?: string;
  description?: string;
  isRecurring: boolean;
  recurringPattern?: string;
  createdAt: string;
  updatedAt: string;
}

// Todo types
export interface TodoItem {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  dueDate?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

// Alert types
export interface Alert {
  id: string;
  type: 'budget_exceeded' | 'low_balance' | 'upcoming_bill' | 'goal_milestone' | 'recurring_expense' | 'other';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  isRead: boolean;
  data?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// Net Worth Entry types
export interface NetWorthEntry {
  id: string;
  date: string;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  createdAt: string;
  updatedAt: string;
}

// Dashboard Config types
export interface DashboardConfig {
  id: string;
  userId: string;
  layout: 'grid' | 'list' | 'custom';
  widgets: DashboardWidget[];
  theme: 'light' | 'dark' | 'auto';
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardWidget {
  id: string;
  type: string;
  size: 'small' | 'medium' | 'large';
  position: { row: number; col: number };
  settings?: Record<string, unknown>;
}

// Analytics types
export interface Analytics {
  id: string;
  date: string;
  totalIncome: number;
  totalExpense: number;
  netCashflow: number;
  categoryBreakdown: Record<string, number>;
  merchantBreakdown: Record<string, number>;
  createdAt: string;
  updatedAt: string;
}

// Settings types
export interface Settings {
  id: string;
  key: string;
  value: unknown;
  dataType: string;
  createdAt: string;
  updatedAt: string;
}

// Union type for all entities
export type Entity = 
  | Transaction 
  | Account 
  | Category 
  | Budget 
  | Goal 
  | Expense 
  | IncomeSource 
  | Forecast 
  | CalendarEvent 
  | TodoItem 
  | Alert 
  | NetWorthEntry 
  | Settings;

/**
 * Database Query Types
 */

export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
  filters?: Record<string, unknown>;
}

export interface QueryResult<T> {
  data: T[];
  total: number;
  limit?: number;
  offset?: number;
}

/**
 * CRUD Operation Types
 */

export interface CRUDRepository<T extends Entity> {
  create(entity: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>;
  read(id: string): Promise<T | null>;
  readAll(options?: QueryOptions): Promise<QueryResult<T>>;
  update(id: string, changes: Partial<Omit<T, 'id' | 'createdAt'>>): Promise<T>;
  delete(id: string): Promise<boolean>;
}
