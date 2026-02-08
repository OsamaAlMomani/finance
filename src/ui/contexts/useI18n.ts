import { createContext, useContext } from 'react';
import type { Language } from '../i18n';

type I18nContextValue = {
  language: Language;
  setLanguage: (next: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  dir: 'ltr' | 'rtl';
};

const I18nContext = createContext<I18nContextValue | null>(null);

const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
};

export type { I18nContextValue };
export { I18nContext, useI18n };
