import type { ReactNode } from 'react';

type CardVariant = 'default' | 'glass' | 'elevated' | 'gradient' | 'outline';

type CardColor = 'primary' | 'success' | 'warning' | 'danger' | 'neutral';

interface CardProps {
  children: ReactNode;
  className?: string;
  variant?: CardVariant;
  color?: CardColor;
}

const variantClassMap: Record<CardVariant, string> = {
  default: 'card',
  glass: 'card',
  elevated: 'card',
  gradient: 'card',
  outline: 'card'
};

const colorClassMap: Record<CardColor, string> = {
  primary: 'text-blue-700',
  success: 'text-green-700',
  warning: 'text-amber-700',
  danger: 'text-red-700',
  neutral: 'text-gray-700'
};

export default function Card({ children, className, variant = 'default', color = 'neutral' }: CardProps) {
  return (
    <div className={`${variantClassMap[variant]} ${colorClassMap[color]} ${className ?? ''}`.trim()}>
      {children}
    </div>
  );
}

interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  trend?: { value: number; direction: 'up' | 'down' };
  color?: CardColor;
  variant?: CardVariant;
}

export function StatCard({ icon, label, value, trend, color = 'neutral', variant = 'default' }: StatCardProps) {
  return (
    <Card variant={variant} color={color} className="stat-card">
      <div className="flex items-center gap-3">
        <div className="stat-card-icon">{icon}</div>
        <div className="stat-card-body">
          <p className="text-sm font-bold uppercase text-gray-500">{label}</p>
          <div className="text-2xl font-bold">{value}</div>
          {trend && (
            <div className={`text-sm font-bold ${trend.direction === 'up' ? 'text-green-600' : 'text-red-600'}`}>
              {trend.direction === 'up' ? '+' : '-'}{trend.value.toFixed(1)}%
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
