import { useMemo, useState, type CSSProperties, type ComponentType } from 'react';
import ReactEChartsCoreModule from 'echarts-for-react/lib/core';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CalendarDays, CheckCircle2, Circle, DollarSign, Eye, Tags, TrendingDown } from 'lucide-react';
import { BarChart, LineChart } from 'echarts/charts';
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

interface BudgetAlignmentPoint {
  budgetId: string;
  categoryId: string;
  category: string;
  color: string;
  period: string;
  limitAmount: number;
  spentAmount: number;
  remainingAmount: number;
  usagePct: number;
  alertCount: number;
  status: 'on_track' | 'watch' | 'overspent';
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
  alertCount: number;
  health: string;
}

interface BillsPressurePoint {
  billId: string;
  name: string;
  amount: number;
  dueDate: string;
  daysToDue: number;
  alertCount: number;
  status: 'overdue' | 'due_soon' | 'upcoming';
}

interface GoalProgressPoint {
  goalId: string;
  name: string;
  currentAmount: number;
  targetAmount: number;
  remainingAmount: number;
  progressPct: number;
  targetDate: string;
  riskStatus: string;
  linkedAccountName: string;
}

interface DashboardTrendTagOption {
  id: string;
  name: string;
  color: string;
  totalAmount: number;
  txCount: number;
}

interface DashboardTrendPoint {
  date: string;
  day: string;
  total: number;
  tagAmounts: Record<string, number>;
}

interface DashboardExpenseTrendPayload {
  month: string;
  currentDay: string | null;
  daysInMonth: number;
  totalMonthSpend: number;
  tagOptions: DashboardTrendTagOption[];
  points: DashboardTrendPoint[];
}

interface DashboardOptimizationPayload {
  asOf: string;
  periodDays: number;
  stats: DashboardStats;
  budgetAlignment: BudgetAlignmentPoint[];
  debtPressure: DebtPressurePoint[];
  billsPressure: BillsPressurePoint[];
  goalProgress: GoalProgressPoint[];
  expenseTrend: DashboardExpenseTrendPayload;
}

const PERIOD_OPTIONS = [30, 90, 180] as const;

echarts.use([
  BarChart,
  LineChart,
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

type AxisTooltipParam = {
  axisValue?: string;
  seriesName?: string;
  value?: number | string;
  dataIndex?: number;
};

const ReactEChartsCore = (
  (ReactEChartsCoreModule as unknown as { default?: ComponentType<EChartsCoreProps> }).default ||
  (ReactEChartsCoreModule as unknown as ComponentType<EChartsCoreProps>)
);

const CHART_COLORS = {
  text: '#11203b',
  muted: '#60718e',
  primary: '#255af6',
  accent: '#63b7ff',
  info: '#6d7cff',
  slate: '#314562',
  warning: '#c88a1d',
  danger: '#d45564',
  success: '#0f8c7b',
  border: '#d6e1f5',
  softFill: 'rgba(37, 90, 246, 0.10)',
  neutralFill: 'rgba(17, 32, 59, 0.06)'
};

const sharedLegendStyle = {
  top: 2,
  textStyle: {
    color: CHART_COLORS.muted,
    fontSize: 12,
    fontWeight: 700
  },
  itemGap: 16
};

const sharedAxisLabelStyle = {
  color: CHART_COLORS.muted,
  fontWeight: 600
};

const sharedSplitLineStyle = {
  show: true,
  lineStyle: { color: 'rgba(214, 225, 245, 0.85)' }
};

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toCurrencyCode = (value: unknown, fallback = 'USD') => {
  const normalized = String(value || fallback).trim().toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : fallback;
};

const padNumber = (value: number) => String(value).padStart(2, '0');

const humanizeToken = (value: string) =>
  String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const getCurrentMonthValue = (date = new Date()) => `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}`;

const buildEmptyExpenseTrend = (month: string): DashboardExpenseTrendPayload => {
  const currentDate = new Date();
  const [yearRaw, monthRaw] = String(month || '').split('-').map(Number);
  const year = Number.isInteger(yearRaw) ? yearRaw : currentDate.getFullYear();
  const monthIndex = Number.isInteger(monthRaw) && monthRaw >= 1 && monthRaw <= 12
    ? monthRaw
    : currentDate.getMonth() + 1;
  const monthKey = `${year}-${padNumber(monthIndex)}`;
  const daysInMonth = new Date(year, monthIndex, 0).getDate();

  return {
    month: monthKey,
    currentDay: null,
    daysInMonth,
    totalMonthSpend: 0,
    tagOptions: [],
    points: Array.from({ length: daysInMonth }, (_, index) => {
      const day = padNumber(index + 1);
      return {
        date: `${monthKey}-${day}`,
        day,
        total: 0,
        tagAmounts: {}
      };
    })
  };
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

const normalizePayload = (input: unknown, defaultPeriod = 90, trendMonth = getCurrentMonthValue()): DashboardOptimizationPayload => {
  const raw = (input || {}) as Partial<DashboardOptimizationPayload>;
  const statsRaw = (raw.stats || {}) as Partial<DashboardStats>;
  const budgetRows = Array.isArray(raw.budgetAlignment) ? raw.budgetAlignment : [];
  const debtRows = Array.isArray(raw.debtPressure) ? raw.debtPressure : [];
  const billRows = Array.isArray(raw.billsPressure) ? raw.billsPressure : [];
  const goalRows = Array.isArray(raw.goalProgress) ? raw.goalProgress : [];
  const fallbackTrend = buildEmptyExpenseTrend(trendMonth);
  const trendRaw = (raw.expenseTrend || {}) as Partial<DashboardExpenseTrendPayload>;
  const trendTagRows = Array.isArray(trendRaw.tagOptions) ? trendRaw.tagOptions : [];
  const trendPoints = Array.isArray(trendRaw.points) ? trendRaw.points : [];

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
    budgetAlignment: budgetRows.map((row) => ({
      budgetId: String(row.budgetId || ''),
      categoryId: String(row.categoryId || 'uncategorized'),
      category: String(row.category || 'Uncategorized'),
      color: String(row.color || '#6B7280') || '#6B7280',
      period: String(row.period || 'monthly'),
      limitAmount: Math.max(0, toNumber(row.limitAmount)),
      spentAmount: Math.max(0, toNumber(row.spentAmount)),
      remainingAmount: toNumber(row.remainingAmount),
      usagePct: Math.max(0, toNumber(row.usagePct)),
      alertCount: Math.max(0, Math.floor(toNumber(row.alertCount))),
      status: String(row.status || 'on_track') as 'on_track' | 'watch' | 'overspent'
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
      alertCount: Math.max(0, Math.floor(toNumber(row.alertCount))),
      health: String(row.health || 'low')
    })),
    billsPressure: billRows.map((row) => ({
      billId: String(row.billId || ''),
      name: String(row.name || 'Bill'),
      amount: Math.max(0, toNumber(row.amount)),
      dueDate: String(row.dueDate || ''),
      daysToDue: toNumber(row.daysToDue, 9999),
      alertCount: Math.max(0, Math.floor(toNumber(row.alertCount))),
      status: String(row.status || 'upcoming') as 'overdue' | 'due_soon' | 'upcoming'
    })),
    goalProgress: goalRows.map((row) => ({
      goalId: String(row.goalId || ''),
      name: String(row.name || 'Goal'),
      currentAmount: Math.max(0, toNumber(row.currentAmount)),
      targetAmount: Math.max(0, toNumber(row.targetAmount)),
      remainingAmount: Math.max(0, toNumber(row.remainingAmount)),
      progressPct: Math.max(0, toNumber(row.progressPct)),
      targetDate: String(row.targetDate || ''),
      riskStatus: String(row.riskStatus || 'normal'),
      linkedAccountName: String(row.linkedAccountName || '')
    })),
    expenseTrend: {
      month: String(trendRaw.month || fallbackTrend.month),
      currentDay: trendRaw.currentDay ? String(trendRaw.currentDay) : null,
      daysInMonth: Math.max(1, Math.floor(toNumber(trendRaw.daysInMonth, fallbackTrend.daysInMonth))),
      totalMonthSpend: Math.max(0, toNumber(trendRaw.totalMonthSpend, fallbackTrend.totalMonthSpend)),
      tagOptions: trendTagRows.map((row) => ({
        id: String(row.id || ''),
        name: String(row.name || 'Tag'),
        color: String(row.color || '#6B7280') || '#6B7280',
        totalAmount: Math.max(0, toNumber(row.totalAmount)),
        txCount: Math.max(0, Math.floor(toNumber(row.txCount)))
      })),
      points: trendPoints.length > 0
        ? trendPoints.map((row) => ({
          date: String(row.date || ''),
          day: String(row.day || ''),
          total: Math.max(0, toNumber(row.total)),
          tagAmounts: Object.entries((row.tagAmounts || {}) as Record<string, unknown>).reduce<Record<string, number>>((acc, [key, value]) => {
            acc[key] = Math.max(0, toNumber(value));
            return acc;
          }, {})
        }))
        : fallbackTrend.points
    }
  };
};

const buildNoDataOption = (emptyText: string) => ({
  tooltip: { trigger: 'axis' },
  xAxis: { show: false },
  yAxis: { show: false },
  graphic: {
    type: 'text',
    left: 'center',
    top: 'middle',
    style: { text: emptyText, fill: CHART_COLORS.muted, fontSize: 13 }
  },
  series: []
});

const ChartCard = ({
  title,
  eyebrow,
  option,
  loading,
  height = 320
}: {
  title: string;
  eyebrow: string;
  option: object;
  loading: boolean;
  height?: number;
}) => (
  <div className="card dashboard-chart-card">
    <div className="dashboard-card-shell">
      <div className="dashboard-card-header">
        <p className="dashboard-card-eyebrow">{eyebrow}</p>
        <h3 className="dashboard-card-title">{title}</h3>
      </div>

      {loading ? (
        <div className="dashboard-chart-skeleton" style={{ height, width: '100%' }} />
      ) : (
        <ReactEChartsCore
          echarts={echarts}
          option={option}
          style={{ height, width: '100%' }}
          notMerge
          lazyUpdate
        />
      )}
    </div>
  </div>
);

export const Dashboard = () => {
  const { t } = useI18n();
  const currentMonth = useMemo(() => getCurrentMonthValue(), []);
  const [periodDays, setPeriodDays] = useState<30 | 90 | 180>(90);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

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

  const monthFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat('en-US', {
        month: 'long',
        year: 'numeric'
      }),
    []
  );

  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: [...financeQueryKeys.dashboard(), periodDays, selectedMonth],
    queryFn: async () => {
      const payload = await ipcClient.dashboard.getOptimization({ periodDays, month: selectedMonth });
      return normalizePayload(payload, periodDays, selectedMonth);
    },
    enabled: hasElectron
  });

  const payload = data || normalizePayload({ periodDays }, periodDays, selectedMonth);
  const selectedMonthLabel = useMemo(
    () => monthFormatter.format(new Date(`${selectedMonth}-01T00:00:00`)),
    [monthFormatter, selectedMonth]
  );

  const kpis = useMemo(
    () => [
      {
        id: 'total-spend',
        label: t('dashboard.optimization.kpi.totalSpend'),
        value: moneyFormatter.format(payload.stats.totalSpend),
        icon: DollarSign,
        emoji: '💸',
        tone: 'tone-danger'
      },
      {
        id: 'avg-daily-spend',
        label: t('dashboard.optimization.kpi.avgDailySpend'),
        value: moneyFormatter.format(payload.stats.avgDailySpend),
        icon: TrendingDown,
        emoji: '📉',
        tone: 'tone-warning'
      },
      {
        id: 'bills-due',
        label: t('dashboard.optimization.kpi.billsDue7d'),
        value: moneyFormatter.format(payload.stats.billsDue7d),
        icon: CalendarDays,
        emoji: '⚡',
        tone: payload.stats.overdueBills > 0 ? 'tone-danger' : 'tone-warning'
      },
      {
        id: 'debt-load',
        label: t('dashboard.optimization.kpi.debtLoad'),
        value: moneyFormatter.format(payload.stats.debtLoad),
        icon: AlertTriangle,
        emoji: '🏦',
        tone: 'tone-risk'
      }
    ],
    [moneyFormatter, payload.stats.avgDailySpend, payload.stats.billsDue7d, payload.stats.debtLoad, payload.stats.overdueBills, payload.stats.totalSpend, t]
  );

  const selectedTrendTags = useMemo(
    () => payload.expenseTrend.tagOptions.filter((tag) => selectedTagIds.includes(tag.id)),
    [payload.expenseTrend.tagOptions, selectedTagIds]
  );

  const selectedTrendSummary = useMemo(() => {
    if (selectedTrendTags.length === 0) {
      return '🌊 Total line only';
    }

    const previewNames = selectedTrendTags.slice(0, 2).map((tag) => tag.name).join(', ');
    return selectedTrendTags.length <= 2
      ? `🏷️ ${previewNames}`
      : `🏷️ ${previewNames} +${selectedTrendTags.length - 2}`;
  }, [selectedTrendTags]);

  const heroSignals = useMemo(() => {
    const activeTagLabel = selectedTrendTags.length === 0
      ? 'All tags'
      : `${selectedTrendTags.length} active`;
    const billSignal = payload.stats.overdueBills > 0
      ? `${payload.stats.overdueBills} overdue`
      : `${payload.stats.dueSoonBills} due soon`;

    return [
      { id: 'month', emoji: '🧭', label: selectedMonthLabel },
      { id: 'tags', emoji: selectedTrendTags.length === 0 ? '🌊' : '🏷️', label: activeTagLabel },
      { id: 'bills', emoji: payload.stats.overdueBills > 0 ? '⚠️' : '✅', label: billSignal }
    ];
  }, [payload.stats.dueSoonBills, payload.stats.overdueBills, selectedMonthLabel, selectedTrendTags]);

  const trendOption = useMemo(() => {
    const points = payload.expenseTrend.points;
    const trackerPoint = payload.expenseTrend.currentDay
      ? points.find((point) => point.date === payload.expenseTrend.currentDay) || null
      : null;

    const series = [
      {
        type: 'line',
        name: t('dashboard.optimization.trend.total'),
        smooth: true,
        symbol: 'circle',
        symbolSize: 7,
        data: points.map((point) => point.total),
        lineStyle: { color: CHART_COLORS.primary, width: 3 },
        itemStyle: { color: CHART_COLORS.primary },
        areaStyle: { color: CHART_COLORS.softFill },
        emphasis: { focus: 'series' },
        markLine: trackerPoint
          ? {
            symbol: ['none', 'none'],
            label: {
              formatter: t('dashboard.optimization.trend.currentDay'),
              color: CHART_COLORS.danger,
              fontWeight: 700
            },
            lineStyle: { color: CHART_COLORS.danger, type: 'dashed', width: 2 },
            data: [{ xAxis: trackerPoint.day }]
          }
          : undefined,
        markPoint: trackerPoint
          ? {
            symbol: 'circle',
            symbolSize: 15,
            itemStyle: { color: CHART_COLORS.danger },
            label: {
              formatter: t('dashboard.optimization.trend.currentDay'),
              color: CHART_COLORS.danger,
              fontWeight: 700,
              offset: [0, -18]
            },
            data: [{ coord: [trackerPoint.day, trackerPoint.total] }]
          }
          : undefined
      },
      ...selectedTrendTags.map((tag) => ({
        type: 'line',
        name: tag.name,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        data: points.map((point) => toNumber(point.tagAmounts[tag.id], 0)),
        lineStyle: { color: tag.color, width: 2 },
        itemStyle: { color: tag.color },
        emphasis: { focus: 'series' }
      }))
    ];

    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#ffffff',
        borderColor: CHART_COLORS.border,
        borderWidth: 1,
        padding: [10, 12],
        textStyle: {
          color: CHART_COLORS.text,
          fontSize: 12,
          fontWeight: 600
        },
        extraCssText: 'border-radius: 16px; box-shadow: 0 18px 38px rgba(37, 90, 246, 0.12);',
        formatter: (params: AxisTooltipParam[]) => {
          const axisDay = params?.[0]?.axisValue || '--';
          const lines = [`${selectedMonth}-${axisDay}`];

          for (const entry of params || []) {
            lines.push(`${entry.seriesName}: ${moneyFormatter.format(toNumber(entry.value, 0))}`);
          }

          return lines.join('<br/>');
        }
      },
      legend: {
        ...sharedLegendStyle,
        data: series.map((entry) => entry.name)
      },
      grid: { left: 16, right: 16, top: 54, bottom: 30, containLabel: true },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: points.map((point) => point.day),
        name: t('dashboard.optimization.trend.axis.day'),
        axisLabel: sharedAxisLabelStyle,
        axisLine: { lineStyle: { color: CHART_COLORS.border } }
      },
      yAxis: {
        type: 'value',
        name: t('dashboard.optimization.trend.axis.cost'),
        axisLabel: { ...sharedAxisLabelStyle, formatter: (value: number) => compactFormatter.format(value) },
        splitLine: sharedSplitLineStyle
      },
      series
    };
  }, [compactFormatter, moneyFormatter, payload.expenseTrend, selectedMonth, selectedTrendTags, t]);

  const budgetOption = useMemo(() => {
    if (payload.budgetAlignment.length === 0) {
      return buildNoDataOption(t('common.noData'));
    }

    const resolveBudgetPeriodLabel = (period: string) => {
      const key = `budget.period.${period}`;
      const translated = t(key);
      return translated === key ? humanizeToken(period) : translated;
    };

    const labels = payload.budgetAlignment.map((point) => point.category);
    const limits = payload.budgetAlignment.map((point) => ({
      value: point.limitAmount,
      itemStyle: { color: 'rgba(99, 183, 255, 0.3)' }
    }));
    const spend = payload.budgetAlignment.map((point) => ({
      value: point.spentAmount,
      itemStyle: {
        color: point.status === 'overspent'
          ? '#dc2626'
          : point.status === 'watch'
            ? '#f59e0b'
            : point.color
      },
      label: point.alertCount > 0
        ? {
          show: true,
          position: 'right',
          formatter: `! ${point.alertCount}`,
          color: '#b91c1c',
          fontWeight: 700
        }
        : undefined
    }));

    return {
      legend: {
        ...sharedLegendStyle,
        data: [t('dashboard.optimization.legend.limit'), t('dashboard.optimization.legend.spend')]
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#ffffff',
        borderColor: CHART_COLORS.border,
        borderWidth: 1,
        padding: [10, 12],
        textStyle: {
          color: CHART_COLORS.text,
          fontSize: 12,
          fontWeight: 600
        },
        extraCssText: 'border-radius: 16px; box-shadow: 0 18px 38px rgba(37, 90, 246, 0.12);',
        formatter: (params: AxisTooltipParam[]) => {
          const point = payload.budgetAlignment[params?.[0]?.dataIndex ?? 0];
          if (!point) return '';

          const lines = [
            point.category,
            `${t('dashboard.optimization.legend.limit')}: ${moneyFormatter.format(point.limitAmount)}`,
            `${t('dashboard.optimization.legend.spend')}: ${moneyFormatter.format(point.spentAmount)}`,
            `${t('dashboard.optimization.legend.usage')}: ${point.usagePct.toFixed(1)}%`,
            `${t('dashboard.optimization.legend.remaining')}: ${moneyFormatter.format(point.remainingAmount)}`,
            `${t('budget.period')}: ${resolveBudgetPeriodLabel(point.period)}`
          ];

          if (point.alertCount > 0) {
            lines.push(`${t('dashboard.optimization.legend.activeAlerts')}: ${point.alertCount}`);
          }

          return lines.join('<br/>');
        }
      },
      grid: { left: 16, right: 24, top: 46, bottom: 20, containLabel: true },
      xAxis: {
        type: 'value',
        axisLabel: {
          ...sharedAxisLabelStyle,
          formatter: (value: number) => compactFormatter.format(value)
        },
        splitLine: sharedSplitLineStyle
      },
      yAxis: {
        type: 'category',
        data: labels,
        axisLabel: sharedAxisLabelStyle
      },
      dataZoom: [{ type: 'inside', yAxisIndex: 0 }],
      series: [
        {
          type: 'bar',
          name: t('dashboard.optimization.legend.limit'),
          data: limits,
          barWidth: 14,
          emphasis: { focus: 'series' }
        },
        {
          type: 'bar',
          name: t('dashboard.optimization.legend.spend'),
          data: spend,
          barWidth: 14,
          emphasis: { focus: 'series' }
        }
      ]
    };
  }, [compactFormatter, moneyFormatter, payload.budgetAlignment, t]);

  const debtOption = useMemo(() => {
    if (payload.debtPressure.length === 0) {
      return buildNoDataOption(t('common.noData'));
    }

    const labels = payload.debtPressure.map((point) => point.name);
    const balances = payload.debtPressure.map((point) => ({
      value: point.balance,
      itemStyle: { color: CHART_COLORS.primary },
      label: point.alertCount > 0
        ? {
          show: true,
          position: 'top',
          formatter: `! ${point.alertCount}`,
          color: CHART_COLORS.danger,
          fontWeight: 700
        }
        : undefined
    }));
    const rates = payload.debtPressure.map((point) => point.interestRate);
    const payment = payload.debtPressure.map((point) => point.paymentAmount);

    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#ffffff',
        borderColor: CHART_COLORS.border,
        borderWidth: 1,
        padding: [10, 12],
        textStyle: {
          color: CHART_COLORS.text,
          fontSize: 12,
          fontWeight: 600
        },
        extraCssText: 'border-radius: 16px; box-shadow: 0 18px 38px rgba(37, 90, 246, 0.12);',
        formatter: (params: AxisTooltipParam[]) => {
          const point = payload.debtPressure[params?.[0]?.dataIndex ?? 0];
          if (!point) return '';

          const lines = [
            point.name,
            `${t('dashboard.optimization.legend.balance')}: ${moneyFormatter.format(point.balance)}`,
            `${t('dashboard.optimization.legend.interestRate')}: ${point.interestRate.toFixed(2)}%`,
            `${t('dashboard.optimization.legend.payment')}: ${moneyFormatter.format(point.paymentAmount)}`
          ];

          if (point.alertCount > 0) {
            lines.push(`${t('dashboard.optimization.legend.activeAlerts')}: ${point.alertCount}`);
          }

          return lines.join('<br/>');
        }
      },
      legend: {
        ...sharedLegendStyle,
        data: [
          t('dashboard.optimization.legend.balance'),
          t('dashboard.optimization.legend.interestRate'),
          t('dashboard.optimization.legend.payment')
        ]
      },
      grid: { left: 16, right: 16, top: 48, bottom: 34, containLabel: true },
      xAxis: {
        type: 'category',
        data: labels,
        axisLabel: { ...sharedAxisLabelStyle, interval: 0, rotate: 18 }
      },
      yAxis: [
        {
          type: 'value',
          name: t('dashboard.optimization.legend.balance'),
          axisLabel: { ...sharedAxisLabelStyle, formatter: (value: number) => compactFormatter.format(value) },
          splitLine: sharedSplitLineStyle
        },
        {
          type: 'value',
          name: t('dashboard.optimization.legend.interestRate'),
          axisLabel: { ...sharedAxisLabelStyle, formatter: '{value}%' }
        }
      ],
      dataZoom: [{ type: 'inside' }],
      series: [
        {
          type: 'bar',
          name: t('dashboard.optimization.legend.balance'),
          data: balances,
          barWidth: 18
        },
        {
          type: 'line',
          name: t('dashboard.optimization.legend.interestRate'),
          yAxisIndex: 1,
          smooth: true,
          data: rates,
          lineStyle: { color: CHART_COLORS.warning, width: 2 },
          itemStyle: { color: CHART_COLORS.warning }
        },
        {
          type: 'line',
          name: t('dashboard.optimization.legend.payment'),
          smooth: true,
          data: payment,
          lineStyle: { color: CHART_COLORS.info, width: 2 },
          itemStyle: { color: CHART_COLORS.info }
        }
      ]
    };
  }, [compactFormatter, moneyFormatter, payload.debtPressure, t]);

  const billsOption = useMemo(() => {
    if (payload.billsPressure.length === 0) {
      return buildNoDataOption(t('common.noData'));
    }

    const colorForStatus = (status: BillsPressurePoint['status']) => {
      if (status === 'overdue') return CHART_COLORS.danger;
      if (status === 'due_soon') return CHART_COLORS.warning;
      return CHART_COLORS.primary;
    };

    const labels = payload.billsPressure.map((point) => `${point.name} (${point.dueDate || '--'})`);
    const amounts = payload.billsPressure.map((point) => ({
      value: point.amount,
      itemStyle: { color: colorForStatus(point.status) },
      label: point.alertCount > 0
        ? {
          show: true,
          position: 'top',
          formatter: `! ${point.alertCount}`,
          color: CHART_COLORS.danger,
          fontWeight: 700
        }
        : undefined
    }));
    const dueDays = payload.billsPressure.map((point) => point.daysToDue);

    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#ffffff',
        borderColor: CHART_COLORS.border,
        borderWidth: 1,
        padding: [10, 12],
        textStyle: {
          color: CHART_COLORS.text,
          fontSize: 12,
          fontWeight: 600
        },
        extraCssText: 'border-radius: 16px; box-shadow: 0 18px 38px rgba(37, 90, 246, 0.12);',
        formatter: (params: AxisTooltipParam[]) => {
          const point = payload.billsPressure[params?.[0]?.dataIndex ?? 0];
          if (!point) return '';

          const lines = [
            point.name,
            `${t('dashboard.optimization.legend.amount')}: ${moneyFormatter.format(point.amount)}`,
            `${t('dashboard.optimization.legend.daysToDue')}: ${point.daysToDue}`
          ];

          if (point.alertCount > 0) {
            lines.push(`${t('dashboard.optimization.legend.activeAlerts')}: ${point.alertCount}`);
          }

          return lines.join('<br/>');
        }
      },
      legend: {
        ...sharedLegendStyle,
        data: [t('dashboard.optimization.legend.amount'), t('dashboard.optimization.legend.daysToDue')]
      },
      grid: { left: 16, right: 16, top: 48, bottom: 38, containLabel: true },
      xAxis: {
        type: 'category',
        data: labels,
        axisLabel: { ...sharedAxisLabelStyle, interval: 0, rotate: 20 }
      },
      yAxis: [
        {
          type: 'value',
          name: t('dashboard.optimization.legend.amount'),
          axisLabel: { ...sharedAxisLabelStyle, formatter: (value: number) => compactFormatter.format(value) },
          splitLine: sharedSplitLineStyle
        },
        {
          type: 'value',
          name: t('dashboard.optimization.legend.daysToDue'),
          axisLabel: sharedAxisLabelStyle
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
          lineStyle: { color: CHART_COLORS.slate, width: 2 },
          itemStyle: { color: CHART_COLORS.slate },
          data: dueDays
        }
      ]
    };
  }, [compactFormatter, moneyFormatter, payload.billsPressure, t]);

  const goalsOption = useMemo(() => {
    if (payload.goalProgress.length === 0) {
      return buildNoDataOption(t('common.noData'));
    }

    const colorForRisk = (riskStatus: string) => {
      if (riskStatus === 'critical') return CHART_COLORS.danger;
      if (riskStatus === 'at_risk') return '#eb7d37';
      if (riskStatus === 'watch') return CHART_COLORS.warning;
      return CHART_COLORS.success;
    };

    const labels = payload.goalProgress.map((point) => point.name);
    const progress = payload.goalProgress.map((point) => ({
      value: Math.min(point.progressPct, 100),
      itemStyle: { color: colorForRisk(point.riskStatus) }
    }));

    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#ffffff',
        borderColor: CHART_COLORS.border,
        borderWidth: 1,
        padding: [10, 12],
        textStyle: {
          color: CHART_COLORS.text,
          fontSize: 12,
          fontWeight: 600
        },
        extraCssText: 'border-radius: 16px; box-shadow: 0 18px 38px rgba(37, 90, 246, 0.12);',
        formatter: (params: AxisTooltipParam[]) => {
          const point = payload.goalProgress[params?.[0]?.dataIndex ?? 0];
          if (!point) return '';

          const lines = [
            point.name,
            `${t('dashboard.optimization.legend.progress')}: ${point.progressPct.toFixed(1)}%`,
            `${t('goals.current')}: ${moneyFormatter.format(point.currentAmount)}`,
            `${t('goals.target')}: ${moneyFormatter.format(point.targetAmount)}`,
            `${t('dashboard.optimization.legend.remaining')}: ${moneyFormatter.format(point.remainingAmount)}`,
            `${t('common.status')}: ${humanizeToken(point.riskStatus)}`
          ];

          if (point.targetDate) {
            lines.push(`${t('goals.targetDateLabel')}: ${new Date(`${point.targetDate}T00:00:00`).toLocaleDateString()}`);
          }

          if (point.linkedAccountName) {
            lines.push(`${t('common.account')}: ${point.linkedAccountName}`);
          }

          return lines.join('<br/>');
        }
      },
      legend: {
        ...sharedLegendStyle,
        data: [t('dashboard.optimization.legend.progress')]
      },
      grid: { left: 16, right: 24, top: 44, bottom: 20, containLabel: true },
      xAxis: {
        type: 'value',
        min: 0,
        max: 100,
        axisLabel: { ...sharedAxisLabelStyle, formatter: '{value}%' },
        splitLine: sharedSplitLineStyle
      },
      yAxis: {
        type: 'category',
        data: labels,
        axisLabel: sharedAxisLabelStyle
      },
      dataZoom: [{ type: 'inside', yAxisIndex: 0 }],
      series: [
        {
          type: 'bar',
          name: t('dashboard.optimization.legend.progress'),
          data: progress,
          barWidth: 18,
          label: {
            show: true,
            position: 'right',
            formatter: (params: AxisTooltipParam) => `${Math.round(toNumber(params.value, 0))}%`
          }
        }
      ]
    };
  }, [moneyFormatter, payload.goalProgress, t]);

  return (
    <div className="dashboard-page dashboard-modern h-full min-h-0 overflow-auto">
      <div className="dashboard-hero">
        <div className="dashboard-hero-copy">
          <p className="dashboard-hero-eyebrow">{t('dashboard.optimization.eyebrow')}</p>
          <h2 className="text-3xl font-bold heading-font">{t('dashboard.title')}</h2>
          <div className="dashboard-hero-chip-row" aria-label="Dashboard quick view">
            {heroSignals.map((signal) => (
              <span key={signal.id} className="dashboard-hero-chip">
                <span className="dashboard-hero-chip-emoji" aria-hidden="true">{signal.emoji}</span>
                <span>{signal.label}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="dashboard-hero-actions">
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

          <button type="button" className="ui-btn-muted" onClick={() => void refetch()} disabled={isFetching || !hasElectron}>
            {t('dashboard.optimization.refresh')}
          </button>

          <span className="dashboard-hero-stamp">
            <span aria-hidden="true">🕒</span>
            <span>{new Date(payload.asOf).toLocaleString()}</span>
          </span>
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
                <div className="dashboard-kpi-label-row">
                  <span className="dashboard-kpi-emoji" aria-hidden="true">{kpi.emoji}</span>
                  <span className="dashboard-kpi-label">{kpi.label}</span>
                </div>
                <span className="dashboard-kpi-icon">
                  <Icon size={17} />
                </span>
              </div>
              <div className="dashboard-kpi-value">{kpi.value}</div>
            </div>
          );
        })}
      </div>

      <div className="card dashboard-chart-card dashboard-trend-card">
        <div className="dashboard-trend-toolbar">
          <div>
            <h3 className="dashboard-section-title">📈 {t('dashboard.optimization.chart.monthlyCostTrend')}</h3>

            <div className="dashboard-trend-meta">
              <span className="dashboard-meta-pill">🗓️ {selectedMonthLabel}</span>
              <span className="dashboard-meta-pill">
                {selectedTrendTags.length === 0
                  ? '🌊 Total only'
                  : `🏷️ ${selectedTrendTags.length} tag${selectedTrendTags.length === 1 ? '' : 's'}`}
              </span>
              {payload.expenseTrend.currentDay && (
                <span className="dashboard-meta-pill">📍 Today tracker</span>
              )}
              <span className="dashboard-meta-pill">💵 {moneyFormatter.format(payload.expenseTrend.totalMonthSpend)}</span>
            </div>
          </div>

          <div className="dashboard-trend-controls">
            <label className="dashboard-trend-month-control" htmlFor="dashboard-trend-month">
              <span>{t('dashboard.optimization.trend.month')}</span>
              <input
                id="dashboard-trend-month"
                type="month"
                value={selectedMonth}
                onChange={(event) => {
                  setSelectedMonth(event.target.value);
                  setSelectedTagIds([]);
                }}
              />
            </label>

            <button
              type="button"
              className="ui-btn-muted"
              onClick={() => setSelectedTagIds([])}
              disabled={selectedTagIds.length === 0}
            >
              {t('dashboard.optimization.trend.clearTags')}
            </button>
          </div>
        </div>

        <div className="dashboard-tag-filter-row" role="group" aria-label={t('dashboard.optimization.trend.tagFilter')}>
          <span className="dashboard-tag-filter-label">
            <Tags size={14} />
            <span>{t('dashboard.optimization.trend.tagFilter')}</span>
          </span>

          <button
            type="button"
            className={`dashboard-tag-chip ${selectedTagIds.length === 0 ? 'active' : ''}`}
            onClick={() => setSelectedTagIds([])}
            aria-pressed={selectedTagIds.length === 0}
          >
            <span className="dashboard-tag-chip-state">
              <Eye size={14} />
            </span>
            <span>{t('dashboard.optimization.trend.totalOnly')}</span>
          </button>

          {payload.expenseTrend.tagOptions.map((tag) => {
            const isActive = selectedTagIds.includes(tag.id);
            return (
              <button
                key={tag.id}
                type="button"
                className={`dashboard-tag-chip ${isActive ? 'active' : ''}`}
                style={{ '--tag-accent': tag.color } as CSSProperties}
                aria-pressed={isActive}
                onClick={() => {
                  setSelectedTagIds((previous) =>
                    previous.includes(tag.id)
                      ? previous.filter((tagId) => tagId !== tag.id)
                      : [...previous, tag.id]
                  );
                }}
              >
                <span className="dashboard-tag-chip-state">
                  {isActive ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                </span>
                <span className="dashboard-tag-chip-swatch" />
                <span>{tag.name}</span>
                <small>{moneyFormatter.format(tag.totalAmount)}</small>
              </button>
            );
          })}

          {payload.expenseTrend.tagOptions.length === 0 && (
            <span className="dashboard-tag-empty">{t('dashboard.optimization.trend.noTags')}</span>
          )}
        </div>

        <div className="dashboard-tag-selection-copy">
          <Eye size={14} />
          <span>{selectedTrendSummary}</span>
        </div>

        {isLoading ? (
          <div className="dashboard-chart-skeleton dashboard-trend-skeleton" />
        ) : (
          <ReactEChartsCore
            echarts={echarts}
            option={trendOption}
            style={{ height: 360, width: '100%' }}
            notMerge
            lazyUpdate
          />
        )}
      </div>

      <div className="dashboard-chart-grid">
        <ChartCard
          title={`💸 ${t('dashboard.optimization.chart.budgetAlignment')}`}
          eyebrow={t('dashboard.optimization.chartMeta.budget', { count: payload.budgetAlignment.length })}
          option={budgetOption}
          loading={isLoading}
        />
        <ChartCard
          title={`🏦 ${t('dashboard.optimization.chart.debtPressure')}`}
          eyebrow={t('dashboard.optimization.chartMeta.debt', { count: payload.debtPressure.length })}
          option={debtOption}
          loading={isLoading}
        />
        <ChartCard
          title={`⚡ ${t('dashboard.optimization.chart.billsPressure')}`}
          eyebrow={t('dashboard.optimization.chartMeta.bills', { count: payload.billsPressure.length })}
          option={billsOption}
          loading={isLoading}
        />
        <ChartCard
          title={`🎯 ${t('dashboard.optimization.chart.goalProgress')}`}
          eyebrow={t('dashboard.optimization.chartMeta.goals', { count: payload.goalProgress.length })}
          option={goalsOption}
          loading={isLoading}
        />
      </div>

      {isError && (
        <div className="card mt-3 text-sm text-red-700 border-red-200 bg-red-50">
          {t('dashboard.optimization.loadError')}
        </div>
      )}
    </div>
  );
};
