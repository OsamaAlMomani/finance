import { useMemo, useState } from 'react';
import { ThemeContext, type ThemeId } from './useTheme';

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentTheme, setCurrentTheme] = useState<ThemeId>('theme-1');

  const value = useMemo(
    () => ({ currentTheme, setTheme: setCurrentTheme }),
    [currentTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
