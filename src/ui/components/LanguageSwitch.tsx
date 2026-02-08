import { useI18n } from '../contexts/useI18n';

export const LanguageSwitch = ({ labelClassName }: { labelClassName?: string }) => {
  const { language, setLanguage, t } = useI18n();

  return (
    <div>
      <label className={labelClassName || 'block text-sm font-bold mb-1'} htmlFor="settings-language">
        {t('settings.languageLabel')}
      </label>
      <select
        id="settings-language"
        className="w-full p-2 border rounded"
        value={language}
        onChange={e => setLanguage(e.target.value as 'en' | 'ar')}
        title={t('settings.languageLabel')}
      >
        <option value="en">{t('language.english')}</option>
        <option value="ar">{t('language.arabic')}</option>
      </select>
    </div>
  );
};
