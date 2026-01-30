import { useMemo } from 'react';

type CurrencyType = 'income' | 'expense' | 'neutral';

interface AnimatedNumberProps {
  value: number;
  decimals?: number;
  suffix?: string;
}

export default function AnimatedNumber({ value, decimals = 0, suffix = '' }: AnimatedNumberProps) {
  const formatted = useMemo(() => value.toFixed(decimals), [value, decimals]);
  return <span>{formatted}{suffix}</span>;
}

interface CurrencyDisplayProps {
  amount: number;
  currency?: string;
  type?: CurrencyType;
  showSign?: boolean;
}

export function CurrencyDisplay({ amount, currency = 'USD', type = 'neutral', showSign }: CurrencyDisplayProps) {
  const sign = showSign ? (amount >= 0 ? '+' : '-') : '';
  const formatted = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency
  }).format(Math.abs(amount));

  const colorClass = type === 'income' ? 'text-green-600' : type === 'expense' ? 'text-red-600' : 'text-gray-700';

  return <span className={`font-bold ${colorClass}`}>{sign}{formatted}</span>;
}

interface TrendIndicatorProps {
  value: number;
  label?: string;
  showArrow?: boolean;
}

export function TrendIndicator({ value, label, showArrow }: TrendIndicatorProps) {
  const isPositive = value >= 0;
  return (
    <div className={`inline-flex items-center gap-2 text-sm font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
      {showArrow && <span>{isPositive ? '▲' : '▼'}</span>}
      <span>{Math.abs(value).toFixed(1)}</span>
      {label && <span className="text-gray-400 font-normal">{label}</span>}
    </div>
  );
}
