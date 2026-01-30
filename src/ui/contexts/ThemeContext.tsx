import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'

type ThemeId = 'theme-1' | 'theme-2' | 'theme-3' | 'theme-4' | 'theme-5' | 'theme-6' | 'theme-7'

interface ThemeContextType {
  currentTheme: ThemeId
  setTheme: (theme: ThemeId) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const THEME_KEY = 'flexplan-theme'
const DEFAULT_THEME: ThemeId = 'theme-1'

function applyTheme(themeId: ThemeId) {
  // Remove all theme classes
  document.body.classList.remove('theme-1', 'theme-2', 'theme-3', 'theme-4', 'theme-5', 'theme-6', 'theme-7')
  
  // Add new theme class
  document.body.classList.add(themeId)
  
  // Dispatch theme change event
  const themeChangeEvent = new CustomEvent('themeChanged', { 
    detail: { theme: themeId }
  })
  document.dispatchEvent(themeChangeEvent)
}

interface ThemeProviderProps {
  children: ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [currentTheme, setCurrentThemeState] = useState<ThemeId>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(THEME_KEY) as ThemeId | null
      return stored || DEFAULT_THEME
    }
    return DEFAULT_THEME
  })

  // Apply theme on mount and when theme changes
  useEffect(() => {
    applyTheme(currentTheme)
  }, [currentTheme])

  const setTheme = (themeId: ThemeId) => {
    setCurrentThemeState(themeId)
    localStorage.setItem(THEME_KEY, themeId)
  }

  return (
    <ThemeContext.Provider value={{ currentTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
