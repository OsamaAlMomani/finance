import { useMemo, useState, type CSSProperties, type ComponentType } from 'react';
import ReactEChartsCoreModule from 'echarts-for-react/lib/core';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CalendarDays, DollarSign, TrendingDown } from 'lucide-react';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import * as echarts from 'echarts/core';
import { useI18n } from '../contexts/useI18n';
import { financeQueryKeys } from '../query/financeQueryKeys';
import { ipcClient } from '../services/ipcClient';
import '../styles/dashboard.scss';

interface DashboardStats {
  totalSpend: number;
  avgDailySpend: number;
  billsDue7d: number;
  debtLoad: number;
  overdueBills: number;
  dueSoonBills: number;
}

interface CategorySpendPoint {
  categoryId: string;
  category: string;
  amount: number;
  txCount: number;
  sharePct: number;
}

interface DebtPressurePoint {
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

interface BillsPressurePoint {
  billId: string;
  name: string;
  amount: number;
  dueDate: string;
  daysToDue: number;
  status: 'overdue' | 'due_soon' | 'upcoming';
}

interface DashboardOptimizationPayload {
  asOf: string;
  periodDays: number;
  stats: DashboardStats;
  categorySpend: CategorySpendPoint[];
  debtPressure: DebtPressurePoint[];
  billsPressure: BillsPressurePoint[];
}

const PERIOD_OPTIONS = [30, 90, 180] as const;

echarts.use([
  BarChart,
  LineChart,
  PieChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  DataZoomComponent,
  CanvasRenderer
]);

type EChartsCoreProps = {
  echarts: typeof echarts;
  option: object;
  style?: CSSProperties;
  notMerge?: boolean;
  lazyUpdate?: boolean;
};

const ReactEChartsCore = (
  (ReactEChartsCoreModule as unknown as { default?: ComponentType<EChartsCoreProps> }).default ||
  (ReactEChartsCoreModule as unknown as ComponentType<EChartsCoreProps>)
);

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toCurrencyCode = (value: unknown, fallback = 'USD') => {
  const normalized = String(value || fallback).trim().toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : fallback;
};

const getAppCurrency = () => {
  if (typeof window === 'undefined') return 'USD';
  const raw = window.localStorage.getItem('appSettings');
  if (!raw) return 'USD';

  try {
    const parsed = JSON.parse(raw) as { currency?: string };
    return toCurrencyCode(parsed.currency, 'USD');
  } catch {
    return 'USD';
  }
};

const normalizePayload = (input: unknown, defaultPeriod = 90): DashboardOptimizationPayload => {
  const raw = (input || {}) as Partial<DashboardOptimizationPayload>;
  const statsRaw = (raw.stats || {}) as Partial<DashboardStats>;
  const categoryRows = Array.isArray(raw.categorySpend) ? raw.categorySpend : [];
  const debtRows = Array.isArray(raw.debtPressure) ? raw.debtPressure : [];
  const billRows = Array.isArray(raw.billsPressure) ? raw.billsPressure : [];

  return {
    asOf: String(raw.asOf || new Date().toISOString()),
    periodDays: PERIOD_OPTIONS.includes(Number(raw.periodDays) as 30 | 90 | 180)
      ? Number(raw.periodDays)
      : defaultPeriod,
    stats: {
      totalSpend: Math.max(0, toNumber(statsRaw.totalSpend)),
      avgDailySpend: Math.max(0, toNumber(statsRaw.avgDailySpend)),
      billsDue7d: Math.max(0, toNumber(statsRaw.billsDue7d)),
      debtLoad: Math.max(0, toNumber(statsRaw.debtLoad)),
      overdueBills: Math.max(0, toNumber(statsRaw.overdueBills)),
      dueSoonBills: Math.max(0, toNumber(statsRaw.dueSoonBills))
    },
    categorySpend: categoryRows.map((row) => ({
      categoryId: String(row.categoryId || 'uncategorized'),
      category: String(row.category || 'Uncategorized'),
      amount: Math.max(0, toNumber(row.amount)),
      txCount: Math.max(0, toNumber(row.txCount)),
      sharePct: Math.max(0, toNumber(row.sharePct))
    })),
    debtPressure: debtRows.map((row) => ({
      loanId: String(row.loanId || ''),
      name: String(row.name || 'Loan'),
      balance: Math.max(0, toNumber(row.balance)),
      interestRate: Math.max(0, toNumber(row.interestRate)),
      paymentAmount: Math.max(0, toNumber(row.paymentAmount)),
      dueStatus: String(row.dueStatus || 'upcoming'),
      riskScore: Math.max(0, toNumber(row.riskScore)),
      monthlyPressure: Math.max(0, toNumber(row.monthlyPressure)),
      health: String(row.health || 'low')
    })),
    billsPressure: billRows.map((row) => ({
      billId: String(row.billId || ''),
      name: String(row.name || 'Bill'),
      amount: Math.max(0, toNumber(row.amount)),
      dueDate: String(row.dueDate || ''),
      daysToDue: toNumber(row.daysToDue, 9999),
      status: String(row.status || 'upcoming') as 'overdue' | 'due_soon' | 'upcoming'
    }))
  };
};

const buildNoDataOption = (title: string, emptyText: string) => ({
  title: { text: title, left: 'left', textStyle: { fontSize: 14, fontWeight: 700, color: '#0f172a' } },
  tooltip: { trigger: 'axis' },
  xAxis: { show: false },
  yAxis: { show: false },
  graphic: {
    type: 'text',
    left: 'center',
    top: 'middle',
    style: { text: emptyText, fill: '#64748b', fontSize: 13 }
  },
  series: []
});

const ChartCard = ({ option, loading }: { option: object; loading: boolean }) => (
  <div className="card dashboard-chart-card">
    {loading ? (
      <div className="dashboard-chart-skeleton" />
    ) : (
      <ReactEChartsCore
        echarts={echarts}
        option={option}
        style={{ height: 320, width: '100%' }}
        notMerge
        lazyUpdate
      />
    )}
  </div>
);

export const Dashboard = () => {
  const { t } = useI18n();
  const [periodDays, setPeriodDays] = useState<30 | 90 | 180>(90);

  const hasElectron = typeof window !== 'undefined' && Boolean(window.electron?.invoke);
  const currency = useMemo(() => getAppCurrency(), []);

  const moneyFormatter = useMemo(
    () =>
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        maximumFractionDigits: 2
      }),
    [currency]
  );

  const compactFormatter = useMemo(
    () =>
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        notation: 'compact',
        maximumFractionDigits: 1
      }),
    [currency]
  );

  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: [...financeQueryKeys.dashboard(), periodDays],
    queryFn: async () => {
      const payload = await ipcClient.dashboard.getOptimization(periodDays);
      return normalizePayload(payload, periodDays);
    },
    enabled: hasElectron
  });

  const payload = data || normalizePayload({ periodDays }, periodDays);

  const kpis = useMemo(
    () => [
      {
        id: 'total-spend',
        label: t('dashboard.optimization.kpi.totalSpend'),
        value: moneyFormatter.format(payload.stats.totalSpend),
        icon: DollarSign,
        tone: 'tone-danger'
      },
      {
        id: 'avg-daily-spend',
        label: t('dashboard.optimization.kpi.avgDailySpend'),
        value: moneyFormatter.format(payload.stats.avgDailySpend),
        icon: TrendingDown,
        tone: 'tone-warning'
      },
      {
        id: 'bills-due',
        label: t('dashboard.optimization.kpi.billsDue7d'),
        value: moneyFormatter.format(payload.stats.billsDue7d),
        icon: CalendarDays,
        tone: payload.stats.overdueBills > 0 ? 'tone-danger' : 'tone-warning'
      },
      {
        id: 'debt-load',
        label: t('dashboard.optimization.kpi.debtLoad'),
        value: moneyFormatter.format(payload.stats.debtLoad),
        icon: AlertTriangle,
        tone: 'tone-risk'
      }
    ],
    [moneyFormatter, payload.stats.avgDailySpend, payload.stats.billsDue7d, payload.stats.debtLoad, payload.stats.overdueBills, payload.stats.totalSpend, t]
  );

  const categoryOption = useMemo(() => {
    if (payload.categorySpend.length === 0) {
      return buildNoDataOption(t('dashboard.optimization.chart.categorySpend'), t('common.noData'));
    }

    const categories = payload.categorySpend.map((point) => point.category);
    const amounts = payload.categorySpend.map((point) => point.amount);
    const pieData = payload.categorySpend.map((point) => ({ name: point.category, value: point.amount }));

    return {
      title: {
        text: t('dashboard.optimization.chart.categorySpend'),
        left: 'left',
        textStyle: { fontSize: 14, fontWeight: 700, color: '#0f172a' }
      },
      legend: { right: 0, top: 26, orient: 'vertical' },
      tooltip: {
        trigger: 'item',
        formatter: (params: { name: string; value: number; percent?: number }) =>
          `${params.name}<br/>${moneyFormatter.format(toNumber(params.value))}${params.percent !== undefined ? ` (${toNumber(params.percent).toFixed(1)}%)` : ''}`
      },
      grid: { left: 12, right: 200, top: 72, bottom: 24, containLabel: true },
      xAxis: {
        type: 'value',
        axisLabel: {
          formatter: (value: number) => compactFormatter.format(value)
        }
      },
      yAxis: {
        type: 'category',
        data: categories
      },
      dataZoom: [{ type: 'inside', yAxisIndex: 0 }],
      series: [
        {
          type: 'bar',
          name: t('dashboard.optimization.legend.spend'),
          data: amounts,
          itemStyle: { color: '#2563eb' },
          barWidth: 18,
          emphasis: { focus: 'series' }
        },
        {
          type: 'pie',
          name: t('dashboard.optimization.legend.share'),
          radius: ['18%', '33%'],
          center: ['82%', '40%'],
          data: pieData,
          label: { formatter: '{d}%' }
        }
      ]
    };
  }, [compactFormatter, moneyFormatter, payload.categorySpend, t]);

  const debtOption = useMemo(() => {
    if (payload.debtPressure.length === 0) {
      return buildNoDataOption(t('dashboard.optimization.chart.debtPressure'), t('common.noData'));
    }

    const labels = payload.debtPressure.map((point) => point.name);
    const balances = payload.debtPressure.map((point) => point.balance);
    const rates = payload.debtPressure.map((point) => point.interestRate);
    const payment = payload.debtPressure.map((point) => point.paymentAmount);

    return {
      title: {
        text: t('dashboard.optimization.chart.debtPressure'),
        left: 'left',
        textStyle: { fontSize: 14, fontWeight: 700, color: '#0f172a' }
      },
      tooltip: {
        trigger: 'axis'
      },
      legend: {
        top: 26,
        data: [
          t('dashboard.optimization.legend.balance'),
          t('dashboard.optimization.legend.interestRate'),
          t('dashboard.optimization.legend.payment')
        ]
      },
      grid: { left: 16, right: 16, top: 72, bottom: 40, containLabel: true },
      xAxis: {
        type: 'category',
        data: labels,
        axisLabel: { interval: 0, rotate: 18 }
      },
      yAxis: [
        {
          type: 'value',
          name: t('dashboard.optimization.legend.balance'),
          axisLabel: { formatter: (value: number) => compactFormatter.format(value) }
        },
        {
          type: 'value',
          name: t('dashboard.optimization.legend.interestRate'),
          axisLabel: { formatter: '{value}%' }
        }
      ],
      dataZoom: [{ type: 'inside' }],
      series: [
        {
          type: 'bar',
          name: t('dashboard.optimization.legend.balance'),
          data: balances,
          itemStyle: { color: '#dc2626' },
          barWidth: 18
        },
        {
          type: 'line',
          name: t('dashboard.optimization.legend.interestRate'),
          yAxisIndex: 1,
          smooth: true,
          data: rates,
          lineStyle: { color: '#f59e0b', width: 2 },
          itemStyle: { color: '#f59e0b' }
        },
        {
          type: 'line',
          name: t('dashboard.optimization.legend.payment'),
          smooth: true,
          data: payment,
          lineStyle: { color: '#2563eb', width: 2 },
          itemStyle: { color: '#2563eb' }
        }
      ]
    };
  }, [compactFormatter, payload.debtPressure, t]);

  const billsOption = useMemo(() => {
    if (payload.billsPressure.length === 0) {
      return buildNoDataOption(t('dashboard.optimization.chart.billsPressure'), t('common.noData'));
    }

    const colorForStatus = (status: BillsPressurePoint['status']) => {
      if (status === 'overdue') return '#dc2626';
      if (status === 'due_soon') return '#f59e0b';
      return '#2563eb';
    };

    const labels = payload.billsPressure.map((point) => `${point.name} (${point.dueDate || '--'})`);
    const amounts = payload.billsPressure.map((point) => ({
      value: point.amount,
      itemStyle: { color: colorForStatus(point.status) }
    }));
    const dueDays = payload.billsPressure.map((point) => point.daysToDue);

    return {
      title: {
        text: t('dashboard.optimization.chart.billsPressure'),
        left: 'left',
        textStyle: { fontSize: 14, fontWeight: 700, color: '#0f172a' }
      },
      tooltip: { trigger: 'axis' },
      legend: {
        top: 26,
        data: [t('dashboard.optimization.legend.amount'), t('dashboard.optimization.legend.daysToDue')]
      },
      grid: { left: 16, right: 16, top: 72, bottom: 46, containLabel: true },
      xAxis: {
        type: 'category',
        data: labels,
        axisLabel: { interval: 0, rotate: 20 }
      },
      yAxis: [
        {
          type: 'value',
          name: t('dashboard.optimization.legend.amount'),
          axisLabel: { formatter: (value: number) => compactFormatter.format(value) }
        },
        {
          type: 'value',
          name: t('dashboard.optimization.legend.daysToDue')
        }
      ],
      dataZoom: [{ type: 'inside' }],
      series: [
        {
          type: 'bar',
          name: t('dashboard.optimization.legend.amount'),
          data: amounts,
          barWidth: 18
        },
        {
          type: 'line',
          name: t('dashboard.optimization.legend.daysToDue'),
          yAxisIndex: 1,
          smooth: true,
          lineStyle: { color: '#0f172a', width: 2 },
          itemStyle: { color: '#0f172a' },
          data: dueDays
        }
      ]
    };
  }, [compactFormatter, payload.billsPressure, t]);

  return (
    <div className="dashboard-page dashboard-modern h-full min-h-0 overflow-auto">
      <div className="dashboard-toolbar">
        <h2 className="text-3xl font-bold heading-font">{t('dashboard.title')}</h2>
        <div className="dashboard-filter-group" role="tablist" aria-label={t('dashboard.optimization.periodLabel')}>
          {PERIOD_OPTIONS.map((period) => (
            <button
              key={period}
              type="button"
              className={`dashboard-filter-btn ${periodDays === period ? 'active' : ''}`}
              onClick={() => setPeriodDays(period)}
            >
              {period}D
            </button>
          ))}
        </div>
      </div>

      {!hasElectron && (
        <div className="card mt-4 text-sm text-red-700 border-red-200 bg-red-50">
          {t('dashboard.optimization.noBackend')}
        </div>
      )}

      <div className="dashboard-kpi-grid">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.id} className={`card dashboard-kpi-card ${kpi.tone}`}>
              <div className="dashboard-kpi-head">
                <span className="dashboard-kpi-label">{kpi.label}</span>
                <Icon size={17} />
              </div>
              <div className="dashboard-kpi-value">{kpi.value}</div>
            </div>
          );
        })}
      </div>

      <div className="dashboard-chart-grid">
        <ChartCard option={categoryOption} loading={isLoading} />
        <ChartCard option={debtOption} loading={isLoading} />
        <ChartCard option={billsOption} loading={isLoading} />
      </div>

      <div className="dashboard-footer-row">
        <span className="dashboard-refresh-meta">
          {t('dashboard.optimization.lastUpdated')}: {new Date(payload.asOf).toLocaleString()}
        </span>
        <button type="button" className="ui-btn-muted" onClick={() => void refetch()} disabled={isFetching || !hasElectron}>
          {t('dashboard.optimization.refresh')}
        </button>
      </div>

      {isError && (
        <div className="card mt-3 text-sm text-red-700 border-red-200 bg-red-50">
          {t('dashboard.optimization.loadError')}
        </div>
      )}
    </div>
  );
};
