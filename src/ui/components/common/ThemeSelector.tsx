import { useState, useEffect, useRef } from 'react'
import { useTheme } from '../../contexts/useTheme'
import { useI18n } from '../../contexts/useI18n'
import './ThemeSelector.css'

type ThemeId = 'theme-1' | 'theme-2' | 'theme-3' | 'theme-4' | 'theme-5' | 'theme-6' | 'theme-7' | 'theme-girly' | 'theme-men'

interface ThemeOption {
  id: ThemeId
  labelKey: string
  colors: [string, string]
}

const THEMES: ThemeOption[] = [
  { id: 'theme-girly', labelKey: 'theme.selector.option.girly', colors: ['#f093fb', '#fff0fa'] },
  { id: 'theme-men', labelKey: 'theme.selector.option.men', colors: ['#2193b0', '#e8f2f8'] },
  { id: 'theme-1', labelKey: 'theme.selector.option.default', colors: ['#4f46e5', '#7c3aed'] },
  { id: 'theme-2', labelKey: 'theme.selector.option.purple', colors: ['#8b5cf6', '#a78bfa'] },
  { id: 'theme-3', labelKey: 'theme.selector.option.green', colors: ['#10b981', '#34d399'] },
  { id: 'theme-4', labelKey: 'theme.selector.option.orange', colors: ['#f59e0b', '#fbbf24'] },
  { id: 'theme-5', labelKey: 'theme.selector.option.pink', colors: ['#ec4899', '#f472b6'] },
  { id: 'theme-6', labelKey: 'theme.selector.option.dark', colors: ['#111827', '#1f2937'] },
  { id: 'theme-7', labelKey: 'theme.selector.option.light', colors: ['#f8fafc', '#f1f5f9'] }
]

export default function ThemeSelector() {
  const { currentTheme, setTheme } = useTheme()
  const { t } = useI18n()
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
        aria-label={t('theme.selector.change')}
        title={t('theme.selector.change')}
      >
        <i className="fas fa-palette"></i>
        <span>{t('theme.selector.title')}</span>
        <i className={`fas fa-chevron-down ${dropdownOpen ? 'rotated' : ''}`}></i>
      </button>

      <div className={`theme-panel ${dropdownOpen ? 'active' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="theme-grid">
          {THEMES.map((theme) => (
            <div
              key={theme.id}
              className={`theme-card theme-card--${theme.id} ${currentTheme === theme.id ? 'active' : ''}`}
              onClick={() => handleThemeSelect(theme.id)}
              title={t(theme.labelKey)}
            >
              {currentTheme === theme.id && (
                <div className="theme-card-check">
                  <i className="fas fa-check"></i>
                </div>
              )}
              <span className="theme-card-label">{t(theme.labelKey)}</span>
            </div>
          ))}
        </div>

        <div className="theme-actions">
          <button className="btn-theme-secondary" onClick={() => setDropdownOpen(false)}>
            {t('theme.selector.done')}
          </button>
          <button className="btn-theme-primary" onClick={handleReset}>
            {t('theme.selector.reset')}
          </button>
        </div>
      </div>
    </div>
  )
}
