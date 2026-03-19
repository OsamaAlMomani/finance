import { Moon } from 'lucide-react';
import { useI18n } from '../contexts/useI18n';

export const ThemeQuickSwitch = () => {
  const { t } = useI18n();

  return (
    <div className="theme-mode-switch" role="group" aria-label={t('theme.quick.title')}>
      <span className="theme-mode-btn active" aria-label={t('settings.theme.dark')} title={t('settings.theme.dark')}>
        <Moon size={16} />
        <span>{t('settings.theme.dark')}</span>
      </span>
    </div>
  );
};
