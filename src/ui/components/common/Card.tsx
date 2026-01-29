import type { ReactNode, CSSProperties } from 'react'
import './Card.css'

export type CardVariant = 'default' | 'elevated' | 'glass' | 'gradient' | 'outline' | 'glow'
export type CardColor = 'default' | 'primary' | 'success' | 'danger' | 'warning' | 'info'
export type CardSize = 'sm' | 'md' | 'lg'

interface CardProps {
  children: ReactNode
  variant?: CardVariant
  color?: CardColor
  size?: CardSize
  className?: string
  style?: CSSProperties
  onClick?: () => void
  hoverable?: boolean
  animated?: boolean
  icon?: ReactNode
  title?: string
  subtitle?: string
  footer?: ReactNode
  headerAction?: ReactNode
}

export default function Card({
  children,
  variant = 'default',
  color = 'default',
  size = 'md',
  className = '',
  style,
  onClick,
  hoverable = false,
  animated = true,
  icon,
  title,
  subtitle,
  footer,
  headerAction
}: CardProps) {
  const cardClasses = [
    'finance-card',
    `card-variant-${variant}`,
    `card-color-${color}`,
    `card-size-${size}`,
    hoverable ? 'card-hoverable' : '',
    animated ? 'card-animated' : '',
    onClick ? 'card-clickable' : '',
    className
  ].filter(Boolean).join(' ')

  const hasHeader = icon || title || subtitle || headerAction

  return (
    <div
      className={cardClasses}
      style={style}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {hasHeader && (
        <div className="card-header">
          <div className="card-header-content">
            {icon && <div className="card-icon">{icon}</div>}
            <div className="card-titles">
              {title && <h3 className="card-title">{title}</h3>}
              {subtitle && <p className="card-subtitle">{subtitle}</p>}
            </div>
          </div>
          {headerAction && <div className="card-header-action">{headerAction}</div>}
        </div>
      )}
      <div className="card-body">{children}</div>
      {footer && <div className="card-footer">{footer}</div>}
    </div>
  )
}

// Stat Card Component
interface StatCardProps {
  label: string
  value: string | number | ReactNode
  change?: number
  changeLabel?: string
  trend?: { value: number; direction: 'up' | 'down' }
  icon?: ReactNode
  color?: CardColor
  variant?: CardVariant
  size?: CardSize
  loading?: boolean
  prefix?: string
  suffix?: string
  className?: string
}

export function StatCard({
  label,
  value,
  change,
  changeLabel,
  trend,
  icon,
  color = 'default',
  variant = 'default',
  size = 'md',
  loading = false,
  prefix = '',
  suffix = '',
  className = ''
}: StatCardProps) {
  // Support both change prop and trend prop
  const trendValue = trend?.value ?? change
  const trendDirection = trend?.direction ?? (change !== undefined ? (change >= 0 ? 'up' : 'down') : undefined)
  const isPositive = trendDirection === 'up'
  const changeColor = isPositive ? 'success' : 'danger'

  // Check if value is a React element
  const isReactElement = typeof value === 'object' && value !== null

  return (
    <Card
      variant={variant}
      color={color}
      size={size}
      className={`stat-card ${className}`}
      animated
    >
      <div className="stat-card-content">
        <div className="stat-card-main">
          <span className="stat-label">{label}</span>
          {loading ? (
            <div className="stat-value-skeleton" />
          ) : (
            <span className="stat-value">
              {isReactElement ? (
                value
              ) : (
                <>
                  {prefix}
                  <StatAnimatedNumber value={typeof value === 'number' ? value : parseFloat(String(value)) || 0} />
                  {suffix}
                </>
              )}
            </span>
          )}
          {trendValue !== undefined && trendDirection && (
            <div className={`stat-change stat-change-${changeColor}`}>
              <span className="change-icon">{isPositive ? '↑' : '↓'}</span>
              <span className="change-value">{Math.abs(trendValue).toFixed(1)}%</span>
              {changeLabel && <span className="change-label">{changeLabel}</span>}
            </div>
          )}
        </div>
        {icon && <div className="stat-icon">{icon}</div>}
      </div>
    </Card>
  )
}

// Simple animated number component for StatCard
function StatAnimatedNumber({ value }: { value: number }) {
  // Format number with commas
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(value)
  
  return <span className="animated-number">{formatted}</span>
}
