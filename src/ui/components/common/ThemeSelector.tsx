import { useState, useEffect, useRef } from 'react'
import { useTheme } from '../../contexts/ThemeContext'

type ThemeId = 'theme-1' | 'theme-2' | 'theme-3' | 'theme-4' | 'theme-5' | 'theme-6' | 'theme-7'

interface ThemeOption {
  id: ThemeId
  label: string
  colors: [string, string]
}

const THEMES: ThemeOption[] = [
  { id: 'theme-1', label: 'Default', colors: ['#4f46e5', '#7c3aed'] },
  { id: 'theme-2', label: 'Purple', colors: ['#8b5cf6', '#a78bfa'] },
  { id: 'theme-3', label: 'Green', colors: ['#10b981', '#34d399'] },
  { id: 'theme-4', label: 'Orange', colors: ['#f59e0b', '#fbbf24'] },
  { id: 'theme-5', label: 'Pink', colors: ['#ec4899', '#f472b6'] },
  { id: 'theme-6', label: 'Dark', colors: ['#111827', '#1f2937'] },
  { id: 'theme-7', label: 'Light', colors: ['#f8fafc', '#f1f5f9'] }
]

export default function ThemeSelector() {
  const { currentTheme, setTheme } = useTheme()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }

    if (dropdownOpen) {
      document.addEventListener('click', handleClickOutside)
    }

    return () => document.removeEventListener('click', handleClickOutside)
  }, [dropdownOpen])

  const handleThemeSelect = (themeId: ThemeId) => {
    setTheme(themeId)
    setDropdownOpen(false)
  }

  const handleReset = () => {
    setTheme('theme-1' as ThemeId)
  }

  return (
    <div className="theme-selector" ref={dropdownRef}>
      <button
        className="theme-toggle"
        onClick={(e) => {
          e.stopPropagation()
          setDropdownOpen(!dropdownOpen)
        }}
        aria-label="Change theme"
        title="Change theme"
      >
        <i className="fas fa-palette"></i>
        <span>Themes</span>
        <i className={`fas fa-chevron-down ${dropdownOpen ? 'rotated' : ''}`}></i>
      </button>

      <div className={`theme-panel ${dropdownOpen ? 'active' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="theme-grid">
          {THEMES.map((theme) => (
            <div
              key={theme.id}
              className={`theme-card ${currentTheme === theme.id ? 'active' : ''}`}
              onClick={() => handleThemeSelect(theme.id)}
              title={theme.label}
              style={{
                background: `linear-gradient(135deg, ${theme.colors[0]}, ${theme.colors[1]})`
              }}
            >
              {currentTheme === theme.id && (
                <div className="theme-card-check">
                  <i className="fas fa-check"></i>
                </div>
              )}
              <span className="theme-card-label">{theme.label}</span>
            </div>
          ))}
        </div>

        <div className="theme-actions">
          <button className="btn-theme-secondary" onClick={() => setDropdownOpen(false)}>
            Done
          </button>
          <button className="btn-theme-primary" onClick={handleReset}>
            Reset
          </button>
        </div>
      </div>
    </div>
  )
}
