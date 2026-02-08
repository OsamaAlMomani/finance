import { useEffect, useState } from 'react';
import { Trash2, PlusCircle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { CATEGORY_COLOR_OPTIONS, getCategoryColorClass } from '../utils/categoryColor';
import { applyTheme } from '../utils/theme';
import type { ThemeKey } from '../utils/theme';
import { AvatarPicker } from '../components/AvatarPicker';
import { getDefaultAvatar } from '../utils/avatars';
import { useI18n } from '../contexts/useI18n';
import { LanguageSwitch } from '../components/LanguageSwitch';

type Theme = ThemeKey;

interface Category {
  id: string;
  name: string;
  type: string;
  color: string;
  icon?: string;
}

interface UserProfile {
  id: string;
  name: string;
  avatar?: string | null;
}

export const Settings = () => {
  const { t } = useI18n();
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'default');
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCat, setNewCat] = useState({ name: '', type: 'expense', color: '#3B82F6' });
  const [settings, setSettings] = useState(() => {
    const defaults = {
      currency: 'USD',
      locale: 'en-US',
      dateFormat: 'YYYY-MM-DD',
      defaultAccountId: '',
      defaultCategoryId: '',
      defaultBudgetPeriod: 'monthly',
      autoHideBalances: false,
      enableNotifications: true,
      backupReminderDays: 30
    };

    const raw = localStorage.getItem('appSettings');
    if (!raw) return defaults;
    try {
      const parsed = JSON.parse(raw);
      return { ...defaults, ...parsed };
    } catch {
      return defaults;
    }
  });
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  const [activeUser, setActiveUser] = useState<UserProfile | null>(null);

  const saveSettings = (next: typeof settings) => {
    setSettings(next);
    localStorage.setItem('appSettings', JSON.stringify(next));
  };

  const refreshCategories = async () => {
    if (window.electron) {
        const cats = await window.electron.invoke('db-get-categories');
        setCategories(cats);
    }
  };

  useEffect(() => {
    if (!window.electron) return;
    window.electron.invoke('db-get-categories').then((cats) => setCategories(cats));
    window.electron.invoke('db-get-accounts').then((accs) => setAccounts(accs));
    window.electron.invoke('user-get-all').then((data) => {
      const authUserId = localStorage.getItem('authUserId');
      const user = data.users?.find((u: UserProfile) => u.id === authUserId)
        || data.users?.find((u: UserProfile) => u.id === data.activeUserId);
      setActiveUser(user || null);
    });
  }, []);

  useEffect(() => {
    localStorage.setItem('theme', theme);
    applyTheme(theme);
  }, [theme]);

  const handleThemeChange = (t: Theme) => {
    setTheme(t);
  };

  const handleAvatarChange = async (avatar: string) => {
    if (!window.electron || !activeUser) return;
    const data = await window.electron.invoke('user-update-avatar', activeUser.id, avatar);
    const updated = data.users?.find((u: UserProfile) => u.id === activeUser.id) || null;
    setActiveUser(updated);
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!window.electron) return;
    await window.electron.invoke('db-create-category', {
        id: uuidv4(),
        ...newCat,
        icon: 'circle' // Default for now
    });
    setNewCat({ ...newCat, name: '' }); // Reset name only
    refreshCategories();
  };

  const handleDeleteCategory = async (id: string) => {
    if(!confirm(t('settings.categoryDeleteConfirm'))) return;
    if(!window.electron) return;
    await window.electron.invoke('db-delete-category', id);
    refreshCategories();
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold mb-6 heading-font">{t('settings.title')}</h2>
      
      <div className="card mb-8">
        <h3 className="text-xl mb-4 font-bold">{t('settings.themeTitle')}</h3>
        <div className="flex gap-4 flex-wrap">
          <button 
            onClick={() => handleThemeChange('default')}
            className="btn theme-select-btn"
          >
            {t('settings.theme.default')}
          </button>
          
          <button 
            onClick={() => handleThemeChange('girly')}
            className="btn theme-select-btn"
          >
            {t('settings.theme.female')}
          </button>
          
          <button 
            onClick={() => handleThemeChange('men')}
            className="btn theme-select-btn"
          >
            {t('settings.theme.male')}
          </button>

          <button 
            onClick={() => handleThemeChange('dark')}
            className="btn theme-select-btn"
          >
            {t('settings.theme.dark')}
          </button>

          <button 
            onClick={() => handleThemeChange('light')}
            className="btn theme-select-btn"
          >
            {t('settings.theme.white')}
          </button>

          <button 
            onClick={() => handleThemeChange('moonlight')}
            className="btn theme-select-btn"
          >
            {t('settings.theme.moonlight')}
          </button>

          <button 
            onClick={() => handleThemeChange('darknight')}
            className="btn theme-select-btn"
          >
            {t('settings.theme.darknight')}
          </button>

          <button 
            onClick={() => handleThemeChange('sunshine')}
            className="btn theme-select-btn"
          >
            {t('settings.theme.sunshine')}
          </button>
        </div>
      </div>

      <div className="card mb-8">
        <h3 className="text-xl mb-4 font-bold">{t('settings.avatarTitle')}</h3>
        <AvatarPicker
          label={activeUser ? t('settings.avatarLabel', { name: activeUser.name }) : t('settings.avatarFallback')}
          value={activeUser?.avatar || getDefaultAvatar()}
          onChange={handleAvatarChange}
        />
      </div>

      <div className="card mb-8">
        <h3 className="text-xl mb-4 font-bold">{t('settings.generalTitle')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <LanguageSwitch />
          <div>
            <label htmlFor="settings-currency" className="block text-sm font-bold mb-1">{t('settings.currency')}</label>
            <select
              id="settings-currency"
              className="w-full p-2 border rounded"
              value={settings.currency}
              onChange={e => saveSettings({ ...settings, currency: e.target.value })}
              title={t('settings.currency')}
            >
              <option value="USD">{t('settings.currencyOption.usd')}</option>
              <option value="EUR">{t('settings.currencyOption.eur')}</option>
              <option value="GBP">{t('settings.currencyOption.gbp')}</option>
              <option value="JOD">{t('settings.currencyOption.jod')}</option>
              <option value="SAR">{t('settings.currencyOption.sar')}</option>
              <option value="AED">{t('settings.currencyOption.aed')}</option>
            </select>
          </div>
          <div>
            <label htmlFor="settings-locale" className="block text-sm font-bold mb-1">{t('settings.locale')}</label>
            <select
              id="settings-locale"
              className="w-full p-2 border rounded"
              value={settings.locale}
              onChange={e => saveSettings({ ...settings, locale: e.target.value })}
              title={t('settings.locale')}
            >
              <option value="en-US">{t('settings.locale.enUS')}</option>
              <option value="en-GB">{t('settings.locale.enGB')}</option>
              <option value="ar-JO">{t('settings.locale.arJO')}</option>
              <option value="ar-SA">{t('settings.locale.arSA')}</option>
            </select>
          </div>
          <div>
            <label htmlFor="settings-date-format" className="block text-sm font-bold mb-1">{t('settings.dateFormat')}</label>
            <select
              id="settings-date-format"
              className="w-full p-2 border rounded"
              value={settings.dateFormat}
              onChange={e => saveSettings({ ...settings, dateFormat: e.target.value })}
              title={t('settings.dateFormat')}
            >
              <option value="YYYY-MM-DD">{t('settings.dateFormatOption.ymd')}</option>
              <option value="DD/MM/YYYY">{t('settings.dateFormatOption.dmy')}</option>
              <option value="MM/DD/YYYY">{t('settings.dateFormatOption.mdy')}</option>
            </select>
          </div>
          <div>
            <label htmlFor="settings-budget-period" className="block text-sm font-bold mb-1">{t('settings.defaultBudgetPeriod')}</label>
            <select
              id="settings-budget-period"
              className="w-full p-2 border rounded"
              value={settings.defaultBudgetPeriod}
              onChange={e => saveSettings({ ...settings, defaultBudgetPeriod: e.target.value })}
              title={t('settings.defaultBudgetPeriod')}
            >
              <option value="weekly">{t('settings.period.weekly')}</option>
              <option value="monthly">{t('settings.period.monthly')}</option>
              <option value="yearly">{t('settings.period.yearly')}</option>
            </select>
          </div>
          <div>
            <label htmlFor="settings-default-account" className="block text-sm font-bold mb-1">{t('settings.defaultAccount')}</label>
            <select
              id="settings-default-account"
              className="w-full p-2 border rounded"
              value={settings.defaultAccountId}
              onChange={e => saveSettings({ ...settings, defaultAccountId: e.target.value })}
              title={t('settings.defaultAccount')}
            >
              <option value="">{t('settings.none')}</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="settings-default-category" className="block text-sm font-bold mb-1">{t('settings.defaultCategory')}</label>
            <select
              id="settings-default-category"
              className="w-full p-2 border rounded"
              value={settings.defaultCategoryId}
              onChange={e => saveSettings({ ...settings, defaultCategoryId: e.target.value })}
              title={t('settings.defaultCategory')}
            >
              <option value="">{t('settings.none')}</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="card mb-8">
        <h3 className="text-xl mb-4 font-bold">{t('settings.privacyTitle')}</h3>
        <div className="space-y-4">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.autoHideBalances}
              onChange={e => saveSettings({ ...settings, autoHideBalances: e.target.checked })}
            />
            <span>{t('settings.autoHideBalances')}</span>
          </label>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.enableNotifications}
              onChange={e => saveSettings({ ...settings, enableNotifications: e.target.checked })}
            />
            <span>{t('settings.enableNotifications')}</span>
          </label>
          <div>
            <label htmlFor="settings-backup-reminder" className="block text-sm font-bold mb-1">{t('settings.backupReminder')}</label>
            <input
              id="settings-backup-reminder"
              type="number"
              min={1}
              className="w-full p-2 border rounded"
              value={settings.backupReminderDays}
              onChange={e => saveSettings({ ...settings, backupReminderDays: Number(e.target.value) })}
              title={t('settings.backupReminder')}
            />
          </div>
        </div>
      </div>

        <div className="card">
          <h3 className="text-xl mb-4 font-bold">{t('settings.categoriesTitle')}</h3>
            
            <form onSubmit={handleAddCategory} className="flex gap-4 mb-6 p-4 bg-gray-50 rounded-lg border border-dashed border-gray-300 items-end">
                <div className="flex-1">
            <label htmlFor="settings-category-name" className="block text-sm font-bold mb-1">{t('settings.categoryName')}</label>
                    <input 
                        required
                  id="settings-category-name"
                        className="w-full p-2 border rounded"
                        value={newCat.name}
                        onChange={e => setNewCat({...newCat, name: e.target.value})}
                placeholder={t('settings.categoryPlaceholder')}
                    />
                </div>
                <div className="w-[120px]">
            <label htmlFor="settings-category-type" className="block text-sm font-bold mb-1">{t('settings.categoryType')}</label>
                    <select 
                  id="settings-category-type"
                        className="w-full p-2 border rounded"
                        value={newCat.type}
                        onChange={e => setNewCat({...newCat, type: e.target.value})}
                    >
                <option value="expense">{t('settings.categoryExpense')}</option>
                <option value="income">{t('settings.categoryIncome')}</option>
                    </select>
                </div>
              <div>
             <label htmlFor="settings-category-color" className="block text-sm font-bold mb-1">{t('settings.categoryColor')}</label>
                 <div className="flex items-center gap-2">
                  <select
                    id="settings-category-color"
                    className="p-2 border rounded"
                    value={newCat.color}
                    onChange={e => setNewCat({...newCat, color: e.target.value})}
                  >
                    {CATEGORY_COLOR_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <div className={`w-8 h-8 rounded-full border ${getCategoryColorClass(newCat.color)} category-color-swatch`} />
                 </div>
              </div>
                <button type="submit" className="btn bg-blue-500 text-white flex items-center gap-2 h-[42px]">
                  <PlusCircle size={20} /> {t('settings.categoryAdd')}
                </button>
            </form>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {categories.map(cat => (
                  <div key={cat.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                        <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full ${getCategoryColorClass(cat.color)} category-color-swatch`} />
                            <div>
                                <p className="font-bold">{cat.name}</p>
                                <p className="text-xs text-gray-500 uppercase">{cat.type}</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => handleDeleteCategory(cat.id)}
                            className="text-gray-400 hover:text-red-500"
                      aria-label={t('settings.categoryDeleteAria', { name: cat.name })}
                      title={t('settings.categoryDeleteAria', { name: cat.name })}
                        >
                            <Trash2 size={18} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    </div>
  );
};
