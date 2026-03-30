import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Heart } from 'lucide-react';
import { useI18n } from '../contexts/useI18n';

interface SystemState {
  month: string;
  settlement: {
    status: 'in_review' | 'finalized';
    isDirty: boolean;
    unresolvedCount: number;
  } | null;
  report: {
    status: 'ready' | 'missing';
    generatedAt?: string | null;
  };
  alerts: {
    active: number;
    acknowledged: number;
    snoozed: number;
    resolved: number;
  };
}

const defaultState = (month: string): SystemState => ({
  month,
  settlement: null,
  report: { status: 'missing', generatedAt: null },
  alerts: { active: 0, acknowledged: 0, snoozed: 0, resolved: 0 }
});

export const SystemStateBar = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const currentMonth = useMemo(() => new Date().toISOString().slice(0, 7), []);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [isHidden, setIsHidden] = useState(() => localStorage.getItem('system-state-hidden') === '1');
  const [heartGlow, setHeartGlow] = useState(false);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<SystemState>(defaultState(currentMonth));

  const load = useCallback(async () => {
    if (isHidden) {
      setLoading(false);
      return;
    }
    if (!window.electron) return;
    setLoading(true);
    try {
      const data = await window.electron.invoke('db-get-system-state', selectedMonth);
      setState(data || defaultState(selectedMonth));
    } catch {
      setState(defaultState(selectedMonth));
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, isHidden]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onDataChanged = () => {
      void load();
    };
    window.addEventListener('finance:data-changed', onDataChanged);
    return () => window.removeEventListener('finance:data-changed', onDataChanged);
  }, [load]);

  const settlementLabel = !state.settlement
    ? t('systemState.status.missing')
    : state.settlement.status === 'finalized'
      ? t('systemState.status.finalized')
      : t('systemState.status.inReview');

  const toggleHidden = () => {
    setIsHidden((prev) => {
      const next = !prev;
      localStorage.setItem('system-state-hidden', next ? '1' : '0');
      return next;
    });
  };

  if (isHidden) {
    return (
      <button
        type="button"
        className="system-state-fab"
        onClick={toggleHidden}
        aria-label={t('systemState.show')}
        title={t('systemState.show')}
      >
        <Eye size={18} />
      </button>
    );
  }

  return (
    <section className="system-state-bar card mb-4">
      <div className="system-state-top">
        <div className="system-state-header-left">
          <span className="sr-only">{t('systemState.title')}</span>
          <button
            type="button"
            className="system-state-heart-btn"
            aria-label={t('systemState.favorite')}
            title={t('systemState.favorite')}
            onMouseEnter={() => setHeartGlow(true)}
          >
            <Heart
              size={16}
              className={`system-state-heart-icon ${heartGlow ? 'glow-once' : ''}`}
              onAnimationEnd={() => setHeartGlow(false)}
            />
          </button>
        </div>

        <div className="system-state-month system-state-toolbar">
          <label htmlFor="system-state-month">{t('systemState.month')}</label>
          <input
            id="system-state-month"
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          />
          <button type="button" className="system-state-toggle-btn" onClick={toggleHidden}>
            <EyeOff size={16} />
            <span>{t('systemState.hide')}</span>
          </button>
        </div>
      </div>

      <div className="system-state-grid">
        <div className="system-state-chip">
          <span className="chip-label">{t('systemState.settlement')}</span>
          <strong>{loading ? t('common.loading') : settlementLabel}</strong>
          <small>{t('systemState.unresolved')}: {state.settlement?.unresolvedCount || 0}</small>
        </div>

        <div className="system-state-chip">
          <span className="chip-label">{t('systemState.report')}</span>
          <strong>{loading ? t('common.loading') : (state.report.status === 'ready' ? t('systemState.report.ready') : t('systemState.report.missing'))}</strong>
          <small>{state.report.generatedAt ? new Date(state.report.generatedAt).toLocaleString() : t('common.notAvailable')}</small>
        </div>

        <div className="system-state-chip">
          <span className="chip-label">{t('systemState.alerts')}</span>
          <strong>{loading ? t('common.loading') : state.alerts.active}</strong>
          <small>{t('systemState.alertsBreakdown', { acknowledged: state.alerts.acknowledged, snoozed: state.alerts.snoozed })}</small>
        </div>

        <div className="system-state-actions">
          <button className="btn bg-blue-500 text-white" onClick={() => navigate('/transactions')}>
            {t('systemState.quick.transactions')}
          </button>
          <button className="btn bg-yellow-500 text-white" onClick={() => navigate('/alerts')}>
            {t('systemState.quick.alerts')}
          </button>
          <button className="btn bg-green-500 text-white" onClick={() => navigate('/settlement')}>
            {t('systemState.quick.settlement')}
          </button>
          <button className="btn bg-indigo-500 text-white" onClick={() => navigate('/reports')}>
            {t('systemState.quick.reports')}
          </button>
        </div>
      </div>
    </section>
  );
};
