import { createContext, useContext } from 'react';

type ThemeId =
  | 'theme-1'
  | 'theme-2'
  | 'theme-3'
  | 'theme-4'
  | 'theme-5'
  | 'theme-6'
  | 'theme-7'
  | 'theme-girly'
  | 'theme-men';

interface ThemeContextValue {
  currentTheme: ThemeId;
  setTheme: (theme: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return { currentTheme: 'theme-1', setTheme: () => undefined };
  }
  return ctx;
};

export type { ThemeId, ThemeContextValue };
export { ThemeContext, useTheme };
