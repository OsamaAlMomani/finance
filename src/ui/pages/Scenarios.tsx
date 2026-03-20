import { useEffect, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

type PaymentFrequency = 'monthly' | 'biweekly' | 'weekly';
type PlannerMode = 'balanced' | 'debt_attack' | 'goal_focus' | 'custom';
type RiskLevel = 'low' | 'medium' | 'high';

interface Loan {
  id: string;
  name: string;
  current_balance: number;
  interest_rate: number;
  payment_amount: number;
  payment_frequency: PaymentFrequency;
}

interface Goal {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date: string;
  priority?: 'low' | 'medium' | 'high';
}

interface ScenarioRecord {
  id: string;
  title: string;
  result_snapshot?: {
    summary?: {
      finalBalance?: number;
      riskLevel?: string;
    };
  };
  risk_level?: string;
}

interface LoanPlanRow {
  id: string;
  name: string;
  balance: number;
  apr: number;
  minimumPayment: number;
  extraPayment: number;
  totalPayment: number;
  monthsToPayoff: number;
}

interface GoalPlanRow {
  id: string;
  name: string;
  remaining: number;
  monthsLeft: number;
  extraContribution: number;
  etaMonths: number;
}

interface ScenarioCaseResult {
  id: 'worst' | 'normal' | 'best';
  label: string;
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlyAvailable: number;
  loanExtra: number;
  goalExtra: number;
  projectedEndBalance: number;
  lowestBalance: number;
  riskLevel: RiskLevel;
}

interface TimelinePoint {
  month: string;
  income: number;
  expense: number;
  net: number;
  projectedBalance: number;
}

const MODE_PRESETS: Record<Exclude<PlannerMode, 'custom'>, { label: string; loanRatio: number; description: string }> = {
  balanced: {
    label: 'Balanced (70/30)',
    loanRatio: 0.7,
    description: '70% to extra loan payments, 30% to goals.'
  },
  debt_attack: {
    label: 'Debt Attack (90/10)',
    loanRatio: 0.9,
    description: 'Aggressive debt reduction while still funding goals.'
  },
  goal_focus: {
    label: 'Goal Focus (40/60)',
    loanRatio: 0.4,
    description: 'Faster goal progress while keeping debt moving.'
  }
};

const RISK_BADGE_CLASS: Record<RiskLevel, string> = {
  low: 'border-emerald-300 bg-emerald-100 text-emerald-700',
  medium: 'border-amber-300 bg-amber-100 text-amber-800',
  high: 'border-rose-300 bg-rose-100 text-rose-700'
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const currency = (value: number) => `$${value.toFixed(2)}`;

const normalizeMonthlyPayment = (payment: number, frequency: PaymentFrequency) => {
  if (frequency === 'weekly') return payment * (52 / 12);
  if (frequency === 'biweekly') return payment * (26 / 12);
  return payment;
};

const monthsUntilTarget = (targetDate: string) => {
  if (!targetDate) return 1;
  const target = new Date(targetDate);
  if (Number.isNaN(target.getTime())) return 1;

  const now = new Date();
  const yearDiff = target.getFullYear() - now.getFullYear();
  const monthDiff = target.getMonth() - now.getMonth();
  return Math.max(1, yearDiff * 12 + monthDiff);
};

const priorityWeight = (priority?: string) => {
  if (priority === 'high') return 1.3;
  if (priority === 'low') return 0.8;
  return 1;
};

const simulatePayoffMonths = (balance: number, annualRate: number, monthlyPayment: number) => {
  if (balance <= 0) return 0;
  if (monthlyPayment <= 0) return Number.POSITIVE_INFINITY;

  let remaining = balance;
  let months = 0;
  const monthlyRate = annualRate / 100 / 12;

  while (remaining > 0.01 && months < 600) {
    const interest = remaining * monthlyRate;
    const principalPaid = monthlyPayment - interest;
    if (principalPaid <= 0) return Number.POSITIVE_INFINITY;

    remaining = remaining + interest - monthlyPayment;
    months += 1;
  }

  return remaining <= 0.01 ? months : Number.POSITIVE_INFINITY;
};

const buildTimeline = (startBalance: number, monthlyNet: number, months: number, monthlyIncome: number, monthlyExpense: number) => {
  const points: TimelinePoint[] = [];
  let running = startBalance;

  for (let i = 0; i < months; i += 1) {
    const date = new Date();
    date.setMonth(date.getMonth() + i);
    running += monthlyNet;
    points.push({
      month: date.toISOString().slice(0, 7),
      income: Number(monthlyIncome.toFixed(2)),
      expense: Number(monthlyExpense.toFixed(2)),
      net: Number(monthlyNet.toFixed(2)),
      projectedBalance: Number(running.toFixed(2))
    });
  }

  return points;
};

export const ScenariosPage = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [loans, setLoans] = useState<Loan[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [savedScenarios, setSavedScenarios] = useState<ScenarioRecord[]>([]);
  const [startBalance, setStartBalance] = useState(0);

  const [form, setForm] = useState({
    title: '',
    monthlyIncome: '0',
    fixedExpenses: '0',
    emergencyTopUp: '0',
    bufferDelta: '0',
    horizonMonths: '12',
    mode: 'balanced' as PlannerMode,
    customLoanRatio: '70'
  });

  const loadData = async () => {
    if (!window.electron) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [loansData, goalsData, scenariosData, statsData] = await Promise.all([
        window.electron.invoke('db-get-loans'),
        window.electron.invoke('db-get-goals'),
        window.electron.invoke('db-get-scenarios'),
        window.electron.invoke('db-get-dashboard-stats')
      ]);

      setLoans(Array.isArray(loansData) ? (loansData as Loan[]) : []);
      setGoals(Array.isArray(goalsData) ? (goalsData as Goal[]) : []);
      setSavedScenarios(Array.isArray(scenariosData) ? (scenariosData as ScenarioRecord[]) : []);

      const stats = (statsData || {}) as { totalBalance?: number; totalIncome?: number; totalExpense?: number };
      const balance = toNumber(stats.totalBalance);
      const income = toNumber(stats.totalIncome);
      const expenses = toNumber(stats.totalExpense);
      setStartBalance(balance);

      setForm((prev) => {
        const shouldSeedIncome = toNumber(prev.monthlyIncome) === 0 && income > 0;
        const shouldSeedExpenses = toNumber(prev.fixedExpenses) === 0 && expenses > 0;
        if (!shouldSeedIncome && !shouldSeedExpenses) return prev;
        return {
          ...prev,
          monthlyIncome: shouldSeedIncome ? income.toFixed(2) : prev.monthlyIncome,
          fixedExpenses: shouldSeedExpenses ? expenses.toFixed(2) : prev.fixedExpenses
        };
      });
    } catch (error) {
      console.error('Failed to load scenario planner data', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    const onChanged = () => {
      void loadData();
    };
    window.addEventListener('finance:data-changed', onChanged);
    return () => window.removeEventListener('finance:data-changed', onChanged);
  }, []);

  const monthlyIncome = toNumber(form.monthlyIncome);
  const fixedExpenses = toNumber(form.fixedExpenses);
  const emergencyTopUp = toNumber(form.emergencyTopUp);
  const bufferDelta = toNumber(form.bufferDelta);
  const horizonMonths = Math.max(1, Math.round(toNumber(form.horizonMonths) || 12));

  const minimumLoanPayment = useMemo(() => {
    return loans.reduce((sum, loan) => {
      const payment = normalizeMonthlyPayment(toNumber(loan.payment_amount), loan.payment_frequency || 'monthly');
      return sum + payment;
    }, 0);
  }, [loans]);

  const loanRatio = useMemo(() => {
    if (form.mode === 'custom') {
      return clamp(toNumber(form.customLoanRatio) / 100, 0, 1);
    }
    return MODE_PRESETS[form.mode].loanRatio;
  }, [form.customLoanRatio, form.mode]);

  const goalRatio = 1 - loanRatio;
  const availableCash = monthlyIncome - fixedExpenses - minimumLoanPayment - emergencyTopUp + bufferDelta;
  const distributableCash = Math.max(0, availableCash);
  const loanExtraPool = distributableCash * loanRatio;
  const goalExtraPool = distributableCash * goalRatio;

  const loanPlan = useMemo<LoanPlanRow[]>(() => {
    const scored = loans.map((loan) => {
      const balance = Math.max(0, toNumber(loan.current_balance));
      const apr = Math.max(0, toNumber(loan.interest_rate));
      const minimumPayment = normalizeMonthlyPayment(toNumber(loan.payment_amount), loan.payment_frequency || 'monthly');
      const score = balance * Math.max(apr / 100, 0.001);
      return {
        id: loan.id,
        name: loan.name || 'Loan',
        balance,
        apr,
        minimumPayment,
        score
      };
    });

    const totalScore = scored.reduce((sum, loan) => sum + loan.score, 0);
    return scored.map((loan) => {
      const extraPayment =
        totalScore > 0 ? (loanExtraPool * loan.score) / totalScore : scored.length > 0 ? loanExtraPool / scored.length : 0;
      const totalPayment = loan.minimumPayment + extraPayment;
      return {
        id: loan.id,
        name: loan.name,
        balance: loan.balance,
        apr: loan.apr,
        minimumPayment: loan.minimumPayment,
        extraPayment,
        totalPayment,
        monthsToPayoff: simulatePayoffMonths(loan.balance, loan.apr, totalPayment)
      };
    });
  }, [loanExtraPool, loans]);

  const goalsPlan = useMemo<GoalPlanRow[]>(() => {
    const scored = goals.map((goal) => {
      const target = Math.max(0, toNumber(goal.target_amount));
      const current = Math.max(0, toNumber(goal.current_amount));
      const remaining = Math.max(target - current, 0);
      const monthsLeft = monthsUntilTarget(goal.target_date);
      const urgency = remaining > 0 ? (remaining / monthsLeft) * priorityWeight(goal.priority) : 0;
      return {
        id: goal.id,
        name: goal.name || 'Goal',
        remaining,
        monthsLeft,
        urgency
      };
    });

    const totalUrgency = scored.reduce((sum, goal) => sum + goal.urgency, 0);
    return scored.map((goal) => {
      const extraContribution =
        totalUrgency > 0 ? (goalExtraPool * goal.urgency) / totalUrgency : scored.length > 0 ? goalExtraPool / scored.length : 0;
      const etaMonths =
        goal.remaining <= 0 ? 0 : extraContribution > 0 ? goal.remaining / extraContribution : Number.POSITIVE_INFINITY;
      return {
        id: goal.id,
        name: goal.name,
        remaining: goal.remaining,
        monthsLeft: goal.monthsLeft,
        extraContribution,
        etaMonths
      };
    });
  }, [goalExtraPool, goals]);

  const scenarioCases = useMemo<ScenarioCaseResult[]>(() => {
    const cases = [
      { id: 'worst' as const, label: 'Worst Case', incomeFactor: 0.9, expenseFactor: 1.1 },
      { id: 'normal' as const, label: 'Normal Case', incomeFactor: 1, expenseFactor: 1 },
      { id: 'best' as const, label: 'Best Case', incomeFactor: 1.1, expenseFactor: 0.95 }
    ];

    return cases.map((item) => {
      const caseIncome = monthlyIncome * item.incomeFactor;
      const caseExpenses = fixedExpenses * item.expenseFactor;
      const monthlyAvailable = caseIncome - caseExpenses - minimumLoanPayment - emergencyTopUp + bufferDelta;
      const distributable = Math.max(monthlyAvailable, 0);
      const loanExtra = distributable * loanRatio;
      const goalExtra = distributable * goalRatio;
      const timeline = buildTimeline(
        startBalance,
        monthlyAvailable,
        horizonMonths,
        caseIncome,
        caseExpenses + minimumLoanPayment + emergencyTopUp - bufferDelta
      );
      const projectedEndBalance = timeline.length > 0 ? timeline[timeline.length - 1].projectedBalance : startBalance;
      const lowestBalance = timeline.reduce((min, point) => Math.min(min, point.projectedBalance), startBalance);

      let riskLevel: RiskLevel = 'low';
      if (lowestBalance < 0 || monthlyAvailable < 0) {
        riskLevel = 'high';
      } else if (monthlyAvailable < Math.max(100, caseIncome * 0.05)) {
        riskLevel = 'medium';
      }

      return {
        id: item.id,
        label: item.label,
        monthlyIncome: caseIncome,
        monthlyExpenses: caseExpenses,
        monthlyAvailable,
        loanExtra,
        goalExtra,
        projectedEndBalance,
        lowestBalance,
        riskLevel
      };
    });
  }, [bufferDelta, emergencyTopUp, fixedExpenses, goalRatio, horizonMonths, loanRatio, minimumLoanPayment, monthlyIncome, startBalance]);

  const normalCase = scenarioCases.find((item) => item.id === 'normal');
  const selectedPreset = form.mode === 'custom' ? null : MODE_PRESETS[form.mode];

  const handleSaveScenario = async () => {
    if (!window.electron) return;
    const title = form.title.trim();
    if (!title) {
      setSaveError('Add a scenario title before saving.');
      return;
    }
    if (!normalCase) return;

    setSaving(true);
    setSaveError('');

    try {
      const monthlyExpenseForTimeline = normalCase.monthlyExpenses + minimumLoanPayment + emergencyTopUp - bufferDelta;
      const timeline = buildTimeline(
        startBalance,
        normalCase.monthlyAvailable,
        horizonMonths,
        normalCase.monthlyIncome,
        monthlyExpenseForTimeline
      );

      const riskNotes: string[] = [];
      if (normalCase.monthlyAvailable <= 0) {
        riskNotes.push('Available cash is non-positive in normal conditions.');
      } else {
        riskNotes.push('Available cash remains positive under normal assumptions.');
      }
      if (loanPlan.some((loan) => Number.isFinite(loan.monthsToPayoff) && loan.monthsToPayoff > 240)) {
        riskNotes.push('At least one loan payoff is still very long; consider a stronger debt ratio.');
      }
      if (goalsPlan.some((goal) => goal.remaining > 0 && !Number.isFinite(goal.etaMonths))) {
        riskNotes.push('Some goals have no projected completion date with current contribution levels.');
      }

      const resultSnapshot = {
        assumptions: {
          duration_months: horizonMonths,
          monthly_income: monthlyIncome,
          monthly_expense: fixedExpenses,
          minimum_loan_payment: Number(minimumLoanPayment.toFixed(2)),
          emergency_top_up: emergencyTopUp,
          buffer_delta: bufferDelta,
          loan_ratio: Number(loanRatio.toFixed(2)),
          goal_ratio: Number(goalRatio.toFixed(2))
        },
        timeline,
        summary: {
          finalBalance: Number(normalCase.projectedEndBalance.toFixed(2)),
          lowestBalance: Number(normalCase.lowestBalance.toFixed(2)),
          riskLevel: normalCase.riskLevel,
          riskNotes
        }
      };

      await window.electron.invoke('db-save-scenario', {
        id: uuidv4(),
        title,
        assumptions: resultSnapshot.assumptions,
        duration_months: horizonMonths,
        result_snapshot_json: resultSnapshot
      });

      setForm((prev) => ({ ...prev, title: '' }));
      window.dispatchEvent(new CustomEvent('finance:data-changed'));
      await loadData();
    } catch (error) {
      console.error('Failed to save planner scenario', error);
      setSaveError('Failed to save scenario. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteScenario = async (id: string) => {
    if (!window.electron) return;
    if (!confirm('Delete this saved scenario?')) return;
    await window.electron.invoke('db-delete-scenario', id);
    window.dispatchEvent(new CustomEvent('finance:data-changed'));
    await loadData();
  };

  if (loading) {
    return <div>Loading planner...</div>;
  }

  return (
    <div className="h-full flex flex-col overflow-hidden scenarios-page">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-3xl font-bold font-heading">Loan + Goals Planner</h2>
          <p className="text-sm text-gray-500">
            Friendly scenario tools with equations, automatic allocation, and risk previews.
          </p>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-4">
        <section className="card">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h3 className="text-xl font-bold">1) Setup Monthly Inputs</h3>
            <span className="text-xs rounded-full border border-blue-300 bg-blue-100 text-blue-700 px-3 py-1 font-semibold">
              Equation-Driven
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <div>
              <label htmlFor="planner-title" className="block text-sm font-bold mb-1">
                Scenario title
              </label>
              <input
                id="planner-title"
                className="w-full p-2 border rounded"
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="e.g. Balanced plan for next 12 months"
              />
            </div>
            <div>
              <label htmlFor="planner-income" className="block text-sm font-bold mb-1">
                Monthly income (I)
              </label>
              <input
                id="planner-income"
                type="number"
                className="w-full p-2 border rounded"
                value={form.monthlyIncome}
                onChange={(event) => setForm({ ...form, monthlyIncome: event.target.value })}
              />
            </div>
            <div>
              <label htmlFor="planner-expenses" className="block text-sm font-bold mb-1">
                Fixed expenses (E)
              </label>
              <input
                id="planner-expenses"
                type="number"
                className="w-full p-2 border rounded"
                value={form.fixedExpenses}
                onChange={(event) => setForm({ ...form, fixedExpenses: event.target.value })}
              />
            </div>
            <div>
              <label htmlFor="planner-emergency" className="block text-sm font-bold mb-1">
                Emergency top-up (B)
              </label>
              <input
                id="planner-emergency"
                type="number"
                className="w-full p-2 border rounded"
                value={form.emergencyTopUp}
                onChange={(event) => setForm({ ...form, emergencyTopUp: event.target.value })}
              />
            </div>
            <div>
              <label htmlFor="planner-buffer" className="block text-sm font-bold mb-1">
                What-if monthly delta
              </label>
              <input
                id="planner-buffer"
                type="number"
                className="w-full p-2 border rounded"
                value={form.bufferDelta}
                onChange={(event) => setForm({ ...form, bufferDelta: event.target.value })}
              />
            </div>
            <div>
              <label htmlFor="planner-horizon" className="block text-sm font-bold mb-1">
                Horizon (months)
              </label>
              <input
                id="planner-horizon"
                type="number"
                min={1}
                className="w-full p-2 border rounded"
                value={form.horizonMonths}
                onChange={(event) => setForm({ ...form, horizonMonths: event.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-bold mb-1">Planner mode</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {(['balanced', 'debt_attack', 'goal_focus', 'custom'] as PlannerMode[]).map((mode) => {
                  const isActive = form.mode === mode;
                  const preset = mode === 'custom' ? null : MODE_PRESETS[mode];
                  return (
                    <button
                      key={mode}
                      type="button"
                      className={`text-left rounded-lg border px-3 py-2 transition-colors ${
                        isActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-white'
                      }`}
                      onClick={() => setForm({ ...form, mode })}
                    >
                      <div className="font-bold">{preset ? preset.label : 'Custom Ratio'}</div>
                      <div className="text-xs text-gray-500">
                        {preset ? preset.description : 'Set your own loan-vs-goal allocation ratio.'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {form.mode === 'custom' && (
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label htmlFor="custom-loan-ratio" className="block text-sm font-bold mb-1">
                  Loan share (%)
                </label>
                <input
                  id="custom-loan-ratio"
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={clamp(toNumber(form.customLoanRatio), 0, 100)}
                  onChange={(event) => setForm({ ...form, customLoanRatio: event.target.value })}
                  className="w-full"
                />
              </div>
              <div className="rounded-lg border border-gray-300 bg-gray-50 px-3 py-2">
                <div className="text-sm font-semibold">Current split</div>
                <div className="text-sm text-gray-600">
                  Loans: {Math.round(loanRatio * 100)}% | Goals: {Math.round(goalRatio * 100)}%
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="card">
          <h3 className="text-xl font-bold mb-3">2) Logical Equation Output</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-lg border border-gray-300 bg-gray-50 p-3">
              <p className="font-bold mb-1">Available cash equation</p>
              <p className="text-sm text-gray-700">A = I - E - M - B + D</p>
              <p className="text-sm text-gray-700">
                A = {currency(monthlyIncome)} - {currency(fixedExpenses)} - {currency(minimumLoanPayment)} - {currency(emergencyTopUp)} +{' '}
                {currency(bufferDelta)}
              </p>
              <p className={`font-bold mt-2 ${availableCash >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                A = {currency(availableCash)}
              </p>
            </div>

            <div className="rounded-lg border border-gray-300 bg-gray-50 p-3">
              <p className="font-bold mb-1">Allocation equation</p>
              <p className="text-sm text-gray-700">LoanExtra = max(A, 0) * loanRatio</p>
              <p className="text-sm text-gray-700">GoalExtra = max(A, 0) * goalRatio</p>
              <p className="text-sm mt-2">
                LoanExtra: <span className="font-bold text-blue-700">{currency(loanExtraPool)}</span>
              </p>
              <p className="text-sm">
                GoalExtra: <span className="font-bold text-purple-700">{currency(goalExtraPool)}</span>
              </p>
              {selectedPreset && <p className="text-xs text-gray-500 mt-2">{selectedPreset.description}</p>}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <article className="card min-h-0 flex flex-col">
            <h3 className="text-xl font-bold mb-3">3) Loan Allocation Tool</h3>
            {loanPlan.length === 0 ? (
              <p className="text-gray-500 text-sm">No loans found. Add loans to generate debt allocation recommendations.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="table-header">
                      <th className="text-left p-2">Loan</th>
                      <th className="text-left p-2">Balance</th>
                      <th className="text-left p-2">APR</th>
                      <th className="text-left p-2">Min/mo</th>
                      <th className="text-left p-2">Extra/mo</th>
                      <th className="text-left p-2">ETA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loanPlan.map((loan) => (
                      <tr key={loan.id} className="border-b border-gray-200">
                        <td className="p-2 font-semibold">{loan.name}</td>
                        <td className="p-2">{currency(loan.balance)}</td>
                        <td className="p-2">{loan.apr.toFixed(2)}%</td>
                        <td className="p-2">{currency(loan.minimumPayment)}</td>
                        <td className="p-2 text-blue-700 font-semibold">{currency(loan.extraPayment)}</td>
                        <td className="p-2">
                          {Number.isFinite(loan.monthsToPayoff) ? `${Math.round(loan.monthsToPayoff)} mo` : 'No payoff'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>

          <article className="card min-h-0 flex flex-col">
            <h3 className="text-xl font-bold mb-3">4) Goal Allocation Tool</h3>
            {goalsPlan.length === 0 ? (
              <p className="text-gray-500 text-sm">No goals found. Add goals to generate deadline-aware contributions.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="table-header">
                      <th className="text-left p-2">Goal</th>
                      <th className="text-left p-2">Remaining</th>
                      <th className="text-left p-2">Months Left</th>
                      <th className="text-left p-2">Extra/mo</th>
                      <th className="text-left p-2">ETA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {goalsPlan.map((goal) => (
                      <tr key={goal.id} className="border-b border-gray-200">
                        <td className="p-2 font-semibold">{goal.name}</td>
                        <td className="p-2">{currency(goal.remaining)}</td>
                        <td className="p-2">{goal.monthsLeft}</td>
                        <td className="p-2 text-purple-700 font-semibold">{currency(goal.extraContribution)}</td>
                        <td className="p-2">
                          {goal.etaMonths === 0
                            ? 'Completed'
                            : Number.isFinite(goal.etaMonths)
                            ? `${Math.ceil(goal.etaMonths)} mo`
                            : 'No ETA'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <article className="card">
            <h3 className="text-xl font-bold mb-3">5) Logical Scenario Matrix</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="table-header">
                    <th className="text-left p-2">Case</th>
                    <th className="text-left p-2">Available/mo</th>
                    <th className="text-left p-2">LoanExtra/mo</th>
                    <th className="text-left p-2">GoalExtra/mo</th>
                    <th className="text-left p-2">End Balance</th>
                    <th className="text-left p-2">Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {scenarioCases.map((scenario) => (
                    <tr key={scenario.id} className="border-b border-gray-200">
                      <td className="p-2 font-semibold">{scenario.label}</td>
                      <td className={`p-2 ${scenario.monthlyAvailable >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {currency(scenario.monthlyAvailable)}
                      </td>
                      <td className="p-2 text-blue-700">{currency(scenario.loanExtra)}</td>
                      <td className="p-2 text-purple-700">{currency(scenario.goalExtra)}</td>
                      <td className="p-2">{currency(scenario.projectedEndBalance)}</td>
                      <td className="p-2">
                        <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${RISK_BADGE_CLASS[scenario.riskLevel]}`}>
                          {scenario.riskLevel}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article className="card">
            <h3 className="text-xl font-bold mb-3">6) Save and Reuse</h3>
            <p className="text-sm text-gray-500 mb-3">
              Save this planner setup as a scenario snapshot, then compare it later with your next updates.
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              <button className="btn bg-indigo-600 text-white" onClick={handleSaveScenario} disabled={saving || !form.title.trim()}>
                {saving ? 'Saving...' : 'Save Scenario Snapshot'}
              </button>
            </div>
            {saveError && <p className="text-sm text-rose-700 mb-3">{saveError}</p>}

            <div className="space-y-2 max-h-72 overflow-y-auto">
              {savedScenarios.map((scenario) => {
                const finalBalance = toNumber(scenario.result_snapshot?.summary?.finalBalance);
                const rawRisk = scenario.result_snapshot?.summary?.riskLevel || scenario.risk_level;
                const risk: RiskLevel = rawRisk === 'high' || rawRisk === 'medium' || rawRisk === 'low' ? rawRisk : 'low';
                const riskTone = RISK_BADGE_CLASS[risk];

                return (
                  <div key={scenario.id} className="rounded-lg border border-gray-300 p-3 bg-white">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold">{scenario.title}</p>
                        <p className="text-xs text-gray-500">Projected end balance: {currency(finalBalance)}</p>
                      </div>
                      <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${riskTone}`}>{risk}</span>
                    </div>
                    <button
                      type="button"
                      className="mt-2 btn btn-sm bg-rose-100 text-rose-700"
                      onClick={() => void handleDeleteScenario(scenario.id)}
                    >
                      Delete
                    </button>
                  </div>
                );
              })}
              {savedScenarios.length === 0 && <p className="text-sm text-gray-500">No saved scenarios yet.</p>}
            </div>
          </article>
        </section>
      </div>
    </div>
  );
};
