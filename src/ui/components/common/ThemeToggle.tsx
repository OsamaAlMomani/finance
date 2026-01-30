import { useTheme } from '../../contexts/ThemeContext'
import { Palette } from 'lucide-react'
import './ThemeToggle.css'

type ToggleVariant = 'button' | 'switch' | 'dropdown'
type ThemeId = 'theme-1' | 'theme-2' | 'theme-3' | 'theme-4' | 'theme-5' | 'theme-6' | 'theme-7'

interface ThemeToggleProps {
  variant?: ToggleVariant
  showLabel?: boolean
  className?: string
}

const themes: Array<{ id: ThemeId; label: string }> = [
  { id: 'theme-1', label: 'Default' },
  { id: 'theme-2', label: 'Purple' },
  { id: 'theme-3', label: 'Green' },
  { id: 'theme-4', label: 'Orange' },
  { id: 'theme-5', label: 'Pink' },
  { id: 'theme-6', label: 'Dark' },
  { id: 'theme-7', label: 'Light' }
]

function ThemeToggle({ 
  variant = 'button', 
  showLabel = false,
  className = '' 
}: ThemeToggleProps) {
  const { currentTheme, setTheme } = useTheme()

  const cycleTheme = () => {
    const currentIndex = themes.findIndex(t => t.id === currentTheme)
    const nextIndex = (currentIndex + 1) % themes.length
    setTheme(themes[nextIndex].id)
  }

  const currentThemeLabel = themes.find(t => t.id === currentTheme)?.label || 'Default'

  if (variant === 'button') {
    return (
      <button 
        className={`theme-toggle-btn ${className}`}
        onClick={cycleTheme}
        aria-label="Cycle theme"
        title={`Current: ${currentThemeLabel}`}
      >
        <span className="theme-icon-wrapper">
          <Palette className="theme-icon" size={18} />
        </span>
        {showLabel && (
          <span className="theme-label">
            {currentThemeLabel}
          </span>
        )}
      </button>
    )
  }

  if (variant === 'switch') {
    return (
      <button
        className={`theme-toggle-switch ${className}`}
        onClick={cycleTheme}
        aria-label="Cycle theme"
      >
        <Palette size={18} />
        {showLabel && (
          <span className="switch-label">
            {currentThemeLabel}
          </span>
        )}
      </button>
    )
  }

  // Dropdown variant
  return (
    <div className={`theme-toggle-dropdown ${className}`}>
      <span className="dropdown-label">Theme</span>
      <div className="dropdown-options">
        {themes.map(theme => (
          <button
            key={theme.id}
            className={`dropdown-option ${currentTheme === theme.id ? 'active' : ''}`}
            onClick={() => setTheme(theme.id)}
            aria-label={theme.label}
          >
            <Palette size={16} />
            <span>{theme.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export { ThemeToggle }
export default ThemeToggle
