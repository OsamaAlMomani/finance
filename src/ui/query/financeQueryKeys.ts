export const financeQueryKeys = {
  root: ['finance'] as const,
  dashboard: () => [...financeQueryKeys.root, 'dashboard'] as const,
  accounts: () => [...financeQueryKeys.root, 'accounts'] as const,
  goals: () => [...financeQueryKeys.root, 'goals'] as const,
  loans: () => [...financeQueryKeys.root, 'loans'] as const,
  bills: () => [...financeQueryKeys.root, 'bills'] as const,
  budgets: () => [...financeQueryKeys.root, 'budgets'] as const,
  plans: () => [...financeQueryKeys.root, 'plans'] as const,
  alerts: () => [...financeQueryKeys.root, 'alerts'] as const,
  fx: (base: string) => [...financeQueryKeys.root, 'fx', base] as const
};

