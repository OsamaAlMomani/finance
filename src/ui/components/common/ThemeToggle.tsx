import { useTheme } from '../../contexts/ThemeContext'
import { Sun, Moon, Monitor } from 'lucide-react'
import './ThemeToggle.css'

type ToggleVariant = 'button' | 'switch' | 'dropdown'

interface ThemeToggleProps {
  variant?: ToggleVariant
  showLabel?: boolean
  className?: string
}

function ThemeToggle({ 
  variant = 'button', 
  showLabel = false,
  className = '' 
}: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme()

  if (variant === 'button') {
    return (
      <button 
        className={`theme-toggle-btn ${className}`}
        onClick={toggleTheme}
        aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
        title={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
      >
        <span className="theme-icon-wrapper">
          <Sun className="theme-icon sun-icon" size={18} />
          <Moon className="theme-icon moon-icon" size={18} />
        </span>
        {showLabel && (
          <span className="theme-label">
            {resolvedTheme === 'dark' ? 'Dark' : 'Light'}
          </span>
        )}
      </button>
    )
  }

  if (variant === 'switch') {
    return (
      <label className={`theme-toggle-switch ${className}`}>
        <input
          type="checkbox"
          checked={resolvedTheme === 'dark'}
          onChange={toggleTheme}
          aria-label="Toggle dark mode"
        />
        <span className="switch-track">
          <span className="switch-thumb">
            {resolvedTheme === 'dark' ? (
              <Moon size={12} />
            ) : (
              <Sun size={12} />
            )}
          </span>
        </span>
        {showLabel && (
          <span className="switch-label">
            {resolvedTheme === 'dark' ? 'Dark' : 'Light'} Mode
          </span>
        )}
      </label>
    )
  }

  // Dropdown variant
  return (
    <div className={`theme-toggle-dropdown ${className}`}>
      <span className="dropdown-label">Theme</span>
      <div className="dropdown-options">
        <button
          className={`dropdown-option ${theme === 'light' ? 'active' : ''}`}
          onClick={() => setTheme('light')}
          aria-label="Light mode"
        >
          <Sun size={16} />
          <span>Light</span>
        </button>
        <button
          className={`dropdown-option ${theme === 'dark' ? 'active' : ''}`}
          onClick={() => setTheme('dark')}
          aria-label="Dark mode"
        >
          <Moon size={16} />
          <span>Dark</span>
        </button>
        <button
          className={`dropdown-option ${theme === 'system' ? 'active' : ''}`}
          onClick={() => setTheme('system')}
          aria-label="System theme"
        >
          <Monitor size={16} />
          <span>System</span>
        </button>
      </div>
    </div>
  )
}

export { ThemeToggle }
export default ThemeToggle
