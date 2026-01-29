import { useState, useEffect, useRef } from 'react'
import './AnimatedNumber.css'

interface AnimatedNumberProps {
  value: number
  duration?: number
  decimals?: number
  prefix?: string
  suffix?: string
  className?: string
  formatOptions?: Intl.NumberFormatOptions
  easing?: 'linear' | 'easeOut' | 'easeInOut' | 'spring'
  onComplete?: () => void
}

// Easing functions
const easingFunctions = {
  linear: (t: number) => t,
  easeOut: (t: number) => 1 - Math.pow(1 - t, 3),
  easeInOut: (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  spring: (t: number) => {
    const c4 = (2 * Math.PI) / 3
    return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1
  }
}

export default function AnimatedNumber({
  value,
  duration = 1000,
  decimals = 0,
  prefix = '',
  suffix = '',
  className = '',
  formatOptions,
  easing = 'easeOut',
  onComplete
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(0)
  const previousValue = useRef(0)
  const animationRef = useRef<number | null>(null)
  const startTimeRef = useRef<number | null>(null)

  useEffect(() => {
    const startValue = previousValue.current
    const endValue = value
    const easingFn = easingFunctions[easing]

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp
      }

      const elapsed = timestamp - startTimeRef.current
      const progress = Math.min(elapsed / duration, 1)
      const easedProgress = easingFn(progress)
      
      const currentValue = startValue + (endValue - startValue) * easedProgress
      setDisplayValue(currentValue)

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate)
      } else {
        previousValue.current = endValue
        startTimeRef.current = null
        onComplete?.()
      }
    }

    // Cancel any existing animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }

    startTimeRef.current = null
    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [value, duration, easing, onComplete])

  // Format the number
  const formattedValue = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    ...formatOptions
  }).format(displayValue)

  return (
    <span className={`animated-number-wrapper ${className}`}>
      {prefix}
      <span className="animated-number-value">{formattedValue}</span>
      {suffix}
    </span>
  )
}

// Compact version for currency
interface CurrencyDisplayProps {
  amount: number
  currency?: string
  type?: 'income' | 'expense' | 'neutral'
  showSign?: boolean
  animated?: boolean
  className?: string
}

export function CurrencyDisplay({
  amount,
  currency = 'JOD',
  type = 'neutral',
  showSign = true,
  animated = true,
  className = ''
}: CurrencyDisplayProps) {
  const isPositive = amount >= 0
  const displayType = type === 'neutral' 
    ? (isPositive ? 'income' : 'expense')
    : type

  const sign = showSign 
    ? (displayType === 'income' ? '+' : '−') 
    : ''
  
  const absAmount = Math.abs(amount)

  return (
    <span className={`currency-display currency-${displayType} ${className}`}>
      {sign}
      {animated ? (
        <AnimatedNumber 
          value={absAmount} 
          decimals={2}
          suffix={` ${currency}`}
        />
      ) : (
        <span>{absAmount.toFixed(2)} {currency}</span>
      )}
    </span>
  )
}

// Percentage display with color coding
interface PercentageDisplayProps {
  value: number
  showSign?: boolean
  decimals?: number
  animated?: boolean
  colorCoded?: boolean
  className?: string
}

export function PercentageDisplay({
  value,
  showSign = true,
  decimals = 1,
  animated = true,
  colorCoded = true,
  className = ''
}: PercentageDisplayProps) {
  const isPositive = value >= 0
  const sign = showSign ? (isPositive ? '+' : '') : ''
  const colorClass = colorCoded 
    ? (isPositive ? 'percentage-positive' : 'percentage-negative')
    : ''

  return (
    <span className={`percentage-display ${colorClass} ${className}`}>
      {sign}
      {animated ? (
        <AnimatedNumber value={value} decimals={decimals} suffix="%" />
      ) : (
        <span>{value.toFixed(decimals)}%</span>
      )}
    </span>
  )
}

// Trend indicator component
interface TrendIndicatorProps {
  value: number
  label?: string
  showArrow?: boolean
  showValue?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function TrendIndicator({
  value,
  label,
  showArrow = true,
  showValue = true,
  size = 'md',
  className = ''
}: TrendIndicatorProps) {
  const isPositive = value >= 0
  const trendClass = isPositive ? 'trend-up' : 'trend-down'
  const arrow = isPositive ? '↑' : '↓'

  return (
    <div className={`trend-indicator trend-${size} ${trendClass} ${className}`}>
      {showArrow && <span className="trend-arrow">{arrow}</span>}
      {showValue && (
        <span className="trend-value">
          {Math.abs(value).toFixed(1)}%
        </span>
      )}
      {label && <span className="trend-label">{label}</span>}
    </div>
  )
}
