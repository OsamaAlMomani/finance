export interface DashboardOptimizationStats {
  totalSpend: number;
  avgDailySpend: number;
  billsDue7d: number;
  debtLoad: number;
  overdueBills: number;
  dueSoonBills: number;
}

export interface DashboardOptimizationCategorySpend {
  categoryId: string;
  category: string;
  amount: number;
  txCount: number;
  sharePct: number;
}

export interface DashboardOptimizationDebtPressure {
  loanId: string;
  name: string;
  balance: number;
  interestRate: number;
  paymentAmount: number;
  dueStatus: string;
  riskScore: number;
  monthlyPressure: number;
  health: string;
}

export interface DashboardOptimizationBillPressure {
  billId: string;
  name: string;
  amount: number;
  dueDate: string;
  daysToDue: number;
  status: 'overdue' | 'due_soon' | 'upcoming';
}

export interface DashboardOptimizationPayload {
  asOf: string;
  periodDays: 30 | 90 | 180;
  stats: DashboardOptimizationStats;
  categorySpend: DashboardOptimizationCategorySpend[];
  debtPressure: DashboardOptimizationDebtPressure[];
  billsPressure: DashboardOptimizationBillPressure[];
}

export function normalizeOptimizationPeriod(value: unknown): 30 | 90 | 180;

export function buildDashboardOptimizationPayload(input?: Record<string, unknown>): DashboardOptimizationPayload;
