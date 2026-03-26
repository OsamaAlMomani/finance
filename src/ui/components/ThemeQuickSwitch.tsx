import { Sun } from 'lucide-react';
import { useI18n } from '../contexts/useI18n';

export const ThemeQuickSwitch = () => {
  const { t } = useI18n();

  return (
    <div className="theme-mode-switch" role="group" aria-label={t('theme.quick.title')}>
      <span className="theme-mode-btn active" aria-label={t('settings.theme.light')} title={t('settings.theme.light')}>
        <Sun size={16} />
        <span>{t('settings.theme.light')}</span>
      </span>
    </div>
  );
};
