import { useCallback, useEffect, useMemo, useState } from 'react';
import { translations, type Language } from '../i18n';
import { I18nContext, type I18nContextValue } from './useI18n';

const STORAGE_KEY = 'appLanguage';
const DB_KEY = 'app_language';

const applyDocumentDirection = (language: Language) => {
  const dir = language === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = language;
  document.documentElement.dir = dir;
};

const interpolate = (text: string, params?: Record<string, string | number>) => {
  if (!params) return text;
  return Object.entries(params).reduce((result, [key, value]) => {
    return result.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), String(value));
  }, text);
};

export const I18nProvider = ({ children }: { children: React.ReactNode }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'ar' ? 'ar' : 'en';
  });

  useEffect(() => {
    applyDocumentDirection(language);
  }, [language]);

  useEffect(() => {
    if (!window.electron?.invoke) return;
    const loadFromDb = async () => {
      try {
        const settings = await window.electron.invoke('db-get-app-settings');
        const dbLanguage = settings?.find((item: { key: string; value: string }) => item.key === DB_KEY)?.value;
        if (dbLanguage === 'en' || dbLanguage === 'ar') {
          setLanguageState(dbLanguage);
          localStorage.setItem(STORAGE_KEY, dbLanguage);
        }
      } catch (error) {
        console.error('Failed to load language setting', error);
      }
    };

    loadFromDb();
  }, []);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    localStorage.setItem(STORAGE_KEY, next);
    if (window.electron?.invoke) {
      window.electron.invoke('db-set-app-setting', DB_KEY, next).catch((error: unknown) => {
        console.error('Failed to persist language setting', error);
      });
    }
  }, []);

  const t = useCallback((key: string, params?: Record<string, string | number>) => {
    const base = translations[language]?.[key] || translations.en?.[key] || key;
    return interpolate(base, params);
  }, [language]);

  const value = useMemo<I18nContextValue>(() => ({
    language,
    setLanguage,
    t,
    dir: language === 'ar' ? 'rtl' : 'ltr'
  }), [language, setLanguage, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};
