import { useCallback, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { PlusCircle, Trash2, Edit2 } from 'lucide-react';
import { useI18n } from '../contexts/useI18n';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { onFinanceDataChanged } from '../services/dataEvents';

type PlanItemType = 'transaction' | 'loan' | 'goal';

interface Plan {
  id: string;
  item_type: PlanItemType;
  item_id: string;
  title: string;
  scenario_if?: string;
  scenario_else?: string;
  what_if?: string;
  outcome?: string;
  months_overdue?: number;
}

interface TransactionItem {
  id: string;
  merchant?: string;
  amount?: number;
  date?: string;
}

interface LoanItem {
  id: string;
  name?: string;
  current_balance?: number;
}

interface GoalItem {
  id: string;
  name?: string;
  target_amount?: number;
}

export const PlansPage = () => {
  const { t } = useI18n();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [loans, setLoans] = useState<LoanItem[]>([]);
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [pendingDeletePlanId, setPendingDeletePlanId] = useState<string | null>(null);

  const [planForm, setPlanForm] = useState<Plan>({
    id: '',
    item_type: 'transaction',
    item_id: '',
    title: '',
    scenario_if: '',
    scenario_else: '',
    what_if: '',
    outcome: '',
    months_overdue: 0
  });

  const loadData = useCallback(async () => {
    if (!window.electron) return;
    try {
      const [plansData, txs, loansData, goalsData] = await Promise.all([
        window.electron.invoke('db-get-plans'),
        window.electron.invoke('db-get-transactions', {}),
        window.electron.invoke('db-get-loans'),
        window.electron.invoke('db-get-goals')
      ]);
      setPlans(plansData || []);
      setTransactions(txs || []);
      setLoans(loansData || []);
      setGoals(goalsData || []);
    } catch (e) {
      console.error('Failed to load plans:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const off = onFinanceDataChanged(() => {
      void loadData();
    });
    return off;
  }, [loadData]);

  const getItemOptions = () => {
    if (planForm.item_type === 'transaction') return transactions;
    if (planForm.item_type === 'loan') return loans;
    return goals;
  };

  const formatItemLabel = (item: TransactionItem | LoanItem | GoalItem) => {
    if ('merchant' in item) {
      return `${item.merchant || t('plans.planType.transaction')} (${item.date || t('common.notAvailable')}) - $${item.amount?.toFixed(2) || '0.00'}`;
    }
    if ('current_balance' in item) {
      return `${item.name || t('plans.planType.loan')} - $${item.current_balance?.toFixed(2) || '0.00'}`;
    }
    if ('target_amount' in item) {
      return `${item.name || t('plans.planType.goal')} - $${item.target_amount?.toFixed(2) || '0.00'}`;
    }
    return t('plans.item');
  };

  const renderTimeline = (label: string, steps: string[], colorClass: string) => {
    if (steps.length === 0) return null;
    return (
      <div className="mt-3">
        <p className="text-xs font-bold text-gray-500 mb-2">{label}</p>
        <div className="flex items-center gap-3">
          {steps.map((step, idx) => (
            <div key={`${label}-${idx}`} className="flex items-center gap-3 flex-1">
              <div className={`w-3 h-3 rounded-full ${colorClass}`} />
              <div className="text-xs text-gray-700 flex-1">
                {step}
              </div>
              {idx < steps.length - 1 && (
                <div className="h-[2px] flex-1 bg-gray-200" />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const handleOpenModal = (plan?: Plan) => {
    if (plan) {
      setEditingPlan(plan);
      setPlanForm({
        id: plan.id,
        item_type: plan.item_type,
        item_id: plan.item_id,
        title: plan.title,
        scenario_if: plan.scenario_if || '',
        scenario_else: plan.scenario_else || '',
        what_if: plan.what_if || '',
        outcome: plan.outcome || '',
        months_overdue: plan.months_overdue || 0
      });
    } else {
      const newId = uuidv4();
      setEditingPlan(null);
      setPlanForm({
        id: newId,
        item_type: 'transaction',
        item_id: transactions[0]?.id || '',
        title: '',
        scenario_if: '',
        scenario_else: '',
        what_if: '',
        outcome: '',
        months_overdue: 0
      });
    }
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.electron) return;

    await window.electron.invoke('db-save-plan', planForm);
    setShowModal(false);
    void loadData();
  };

  const handleDelete = async (id: string) => {
    setPendingDeletePlanId(id);
  };

  const confirmDeletePlan = async () => {
    const id = pendingDeletePlanId;
    if (!id) return;
    setPendingDeletePlanId(null);
    if (!window.electron) return;
    await window.electron.invoke('db-delete-plan', id);
    void loadData();
  };

  if (loading) return <div className="card text-ink">{t('common.loading')}</div>;

  return (
    <div className="ui-page-shell overflow-hidden">
      <div className="ui-page-header">
        <h2 className="text-3xl font-bold font-heading">{t('plans.title')}</h2>
        <button onClick={() => handleOpenModal()} className="btn flex items-center gap-2">
          <PlusCircle size={20} /> {t('plans.create')}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 min-h-0 overflow-y-auto pr-1">
        {plans.map(plan => (
          <div key={plan.id} className="card relative overflow-hidden group">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-bold text-xl">{plan.title}</h3>
                <p className="text-sm text-muted">
                  {t('plans.typeLabel')}: {plan.item_type} • {t('plans.itemId')}: {plan.item_id}
                </p>
                <p className="text-xs text-muted">{t('plans.planId')}: {plan.id}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleOpenModal(plan)}
                  className="text-theme-primary hover:text-theme-primary-dark opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label={`${t('common.edit')} ${plan.title}`}
                  title={t('common.edit')}
                >
                  <Edit2 size={14} />
                </button>
                <button
                  onClick={() => handleDelete(plan.id)}
                  className="text-theme-error hover:text-theme-error-dark opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label={`${t('common.delete')} ${plan.title}`}
                  title={t('common.delete')}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            <div className="text-sm text-ink space-y-2">
              {plan.scenario_if && (
                <div>
                  <span className="font-bold">{t('plans.scenarioIf')}</span>
                  <p>{plan.scenario_if}</p>
                </div>
              )}
              {plan.scenario_else && (
                <div>
                  <span className="font-bold">{t('plans.scenarioElse')}</span>
                  <p>{plan.scenario_else}</p>
                </div>
              )}
              {plan.what_if && (
                <div>
                  <span className="font-bold">{t('plans.whatIf')}</span>
                  <p>{plan.what_if}</p>
                </div>
              )}
              {plan.outcome && (
                <div>
                  <span className="font-bold">{t('plans.outcome')}</span>
                  <p>{plan.outcome}</p>
                </div>
              )}
            </div>

            {renderTimeline(
              t('plans.scenarioA'),
              [plan.scenario_if, plan.outcome].filter(Boolean) as string[],
              'bg-green-500'
            )}

            {renderTimeline(
              t('plans.scenarioB'),
              [plan.scenario_else, plan.what_if].filter(Boolean) as string[],
              'bg-orange-500'
            )}

            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                <span>{t('plans.onTime')}</span>
                <span>{t('plans.exceedingMonths')}</span>
              </div>
              <div className="flex items-center gap-1">
                {Array.from({ length: 13 }).map((_, idx) => {
                  const months = Math.min(Number(plan.months_overdue || 0), 12);
                  const isActive = idx === months;
                  const isPast = idx < months;
                  return (
                    <div key={idx} className="flex items-center">
                      <div
                        className={`w-3 h-3 rounded-full border ${
                          isActive
                            ? 'bg-red-500 border-red-600'
                            : isPast
                            ? 'bg-red-200 border-red-300'
                            : 'bg-gray-200 border-gray-300'
                        }`}
                        title={t('plans.monthOverdueTitle', { count: idx })}
                      />
                      {idx < 12 && <div className="w-4 h-[2px] bg-gray-200" />}
                    </div>
                  );
                })}
              </div>
              <div className="text-xs text-red-600 mt-1">
                {t('plans.monthsExceeded', { count: plan.months_overdue || 0 })}
              </div>
            </div>
          </div>
        ))}

        {plans.length === 0 && (
          <div className="col-span-2 ui-empty-state">
            <p className="text-xl font-hand">{t('plans.empty')}</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="app-modal-backdrop" role="presentation" onClick={() => setShowModal(false)}>
          <div className="app-modal-card w-full max-w-2xl" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <h3 className="app-modal-title text-2xl font-heading">
              {editingPlan ? t('plans.edit') : t('plans.createTitle')}
            </h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label htmlFor="plan-id" className="block text-sm font-bold mb-1">{t('plans.planIdLabel')}</label>
                <div className="flex gap-2">
                  <input
                    id="plan-id"
                    className="ui-field ui-field-lg font-hand"
                    value={planForm.id}
                    onChange={e => setPlanForm({ ...planForm, id: e.target.value })}
                    required
                  />
                  {!editingPlan && (
                    <button
                      type="button"
                      onClick={() => setPlanForm({ ...planForm, id: uuidv4() })}
                      className="ui-btn-surface"
                    >
                      {t('common.generate')}
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="plan-type" className="block text-sm font-bold mb-1">{t('plans.planType')}</label>
                  <select
                    id="plan-type"
                    className="ui-field ui-field-lg font-hand"
                    value={planForm.item_type}
                    onChange={e => {
                      const nextType = e.target.value as PlanItemType;
                      const options = nextType === 'transaction' ? transactions : nextType === 'loan' ? loans : goals;
                      setPlanForm({
                        ...planForm,
                        item_type: nextType,
                        item_id: options[0]?.id || ''
                      });
                    }}
                  >
                    <option value="transaction">{t('plans.planType.transaction')}</option>
                    <option value="loan">{t('plans.planType.loan')}</option>
                    <option value="goal">{t('plans.planType.goal')}</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="plan-item" className="block text-sm font-bold mb-1">{t('plans.item')}</label>
                  <select
                    id="plan-item"
                    className="ui-field ui-field-lg font-hand"
                    value={planForm.item_id}
                    onChange={e => setPlanForm({ ...planForm, item_id: e.target.value })}
                    required
                  >
                    {getItemOptions().map(item => (
                      <option key={item.id} value={item.id}>{formatItemLabel(item)}</option>
                    ))}
                  </select>
                  <p className="text-xs text-muted mt-1">
                    {t('plans.selectedItemId', { id: planForm.item_id || t('common.notAvailable') })}
                  </p>
                </div>
              </div>

              <div>
                <label htmlFor="plan-title" className="block text-sm font-bold mb-1">{t('plans.titleLabel')}</label>
                <input
                  id="plan-title"
                  className="ui-field ui-field-lg font-hand"
                  placeholder={t('plans.titlePlaceholder')}
                  required
                  value={planForm.title}
                  onChange={e => setPlanForm({ ...planForm, title: e.target.value })}
                />
              </div>

              <div>
                <label htmlFor="plan-if" className="block text-sm font-bold mb-1">{t('plans.ifLabel')}</label>
                <textarea
                  id="plan-if"
                  className="ui-field ui-field-lg font-hand"
                  rows={2}
                  value={planForm.scenario_if}
                  onChange={e => setPlanForm({ ...planForm, scenario_if: e.target.value })}
                />
              </div>

              <div>
                <label htmlFor="plan-else" className="block text-sm font-bold mb-1">{t('plans.elseLabel')}</label>
                <textarea
                  id="plan-else"
                  className="ui-field ui-field-lg font-hand"
                  rows={2}
                  value={planForm.scenario_else}
                  onChange={e => setPlanForm({ ...planForm, scenario_else: e.target.value })}
                />
              </div>

              <div>
                <label htmlFor="plan-whatif" className="block text-sm font-bold mb-1">{t('plans.whatIfLabel')}</label>
                <textarea
                  id="plan-whatif"
                  className="ui-field ui-field-lg font-hand"
                  rows={2}
                  value={planForm.what_if}
                  onChange={e => setPlanForm({ ...planForm, what_if: e.target.value })}
                />
              </div>

              <div>
                <label htmlFor="plan-outcome" className="block text-sm font-bold mb-1">{t('plans.outcomeLabel')}</label>
                <textarea
                  id="plan-outcome"
                  className="ui-field ui-field-lg font-hand"
                  rows={2}
                  value={planForm.outcome}
                  onChange={e => setPlanForm({ ...planForm, outcome: e.target.value })}
                />
              </div>

              <div>
                <label htmlFor="plan-months" className="block text-sm font-bold mb-1">{t('plans.monthsExceededLabel')}</label>
                <input
                  id="plan-months"
                  type="number"
                  min={0}
                  className="ui-field ui-field-lg font-hand"
                  value={planForm.months_overdue || 0}
                  onChange={e => setPlanForm({ ...planForm, months_overdue: Number(e.target.value) })}
                />
                <p className="text-xs text-muted mt-1">{t('plans.timelineHint')}</p>
              </div>

              <div className="app-modal-actions">
                <button type="button" onClick={() => setShowModal(false)} className="btn app-modal-btn-secondary">
                  {t('common.cancel')}
                </button>
                <button type="submit" className="btn app-modal-btn-primary">
                  {editingPlan ? t('plans.update') : t('plans.createTitle')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingDeletePlanId)}
        title={t('common.delete')}
        message={t('plans.deleteConfirm')}
        destructive
        onCancel={() => setPendingDeletePlanId(null)}
        onConfirm={() => {
          void confirmDeletePlan();
        }}
      />
    </div>
  );
};
