import { useEffect, useState } from 'react';
import { Trash2, PlusCircle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { CATEGORY_COLOR_OPTIONS, getCategoryColorClass } from '../utils/categoryColor';
import { applyTheme } from '../utils/theme';
import type { ThemeKey } from '../utils/theme';
import { AvatarPicker } from '../components/AvatarPicker';
import { getDefaultAvatar } from '../utils/avatars';

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
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'default');
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCat, setNewCat] = useState({ name: '', type: 'expense', color: '#3B82F6' });
  const [settings, setSettings] = useState({
    currency: 'USD',
    locale: 'en-US',
    dateFormat: 'YYYY-MM-DD',
    defaultAccountId: '',
    defaultCategoryId: '',
    defaultBudgetPeriod: 'monthly',
    autoHideBalances: false,
    enableNotifications: true,
    backupReminderDays: 30
  });
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  const [activeUser, setActiveUser] = useState<UserProfile | null>(null);

  const loadSettings = async () => {
    const raw = localStorage.getItem('appSettings');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setSettings(prev => ({ ...prev, ...parsed }));
      } catch {
        // ignore
      }
    }
  };

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
    loadSettings();
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
    if(!confirm("Delete category? Transactions will be uncategorized.")) return;
    if(!window.electron) return;
    await window.electron.invoke('db-delete-category', id);
    refreshCategories();
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold mb-6 heading-font">App Settings</h2>
      
      <div className="card mb-8">
        <h3 className="text-xl mb-4 font-bold">Theme / Aesthetic</h3>
        <div className="flex gap-4 flex-wrap">
          <button 
            onClick={() => handleThemeChange('default')}
            className="btn theme-select-btn"
          >
            Default (Sketch)
          </button>
          
          <button 
            onClick={() => handleThemeChange('girly')}
            className="btn theme-select-btn"
          >
            Female (Watercolor)
          </button>
          
          <button 
            onClick={() => handleThemeChange('men')}
            className="btn theme-select-btn"
          >
            Male (Bold)
          </button>

          <button 
            onClick={() => handleThemeChange('dark')}
            className="btn theme-select-btn"
          >
            Dark
          </button>

          <button 
            onClick={() => handleThemeChange('light')}
            className="btn theme-select-btn"
          >
            White
          </button>

          <button 
            onClick={() => handleThemeChange('moonlight')}
            className="btn theme-select-btn"
          >
            Moon Light
          </button>

          <button 
            onClick={() => handleThemeChange('darknight')}
            className="btn theme-select-btn"
          >
            Dark Night
          </button>

          <button 
            onClick={() => handleThemeChange('sunshine')}
            className="btn theme-select-btn"
          >
            Sunshine
          </button>
        </div>
      </div>

      <div className="card mb-8">
        <h3 className="text-xl mb-4 font-bold">User Avatar</h3>
        <AvatarPicker
          label={activeUser ? `Avatar for ${activeUser.name}` : 'Avatar'}
          value={activeUser?.avatar || getDefaultAvatar()}
          onChange={handleAvatarChange}
        />
      </div>

      <div className="card mb-8">
        <h3 className="text-xl mb-4 font-bold">General Preferences</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="settings-currency" className="block text-sm font-bold mb-1">Currency</label>
            <select
              id="settings-currency"
              className="w-full p-2 border rounded"
              value={settings.currency}
              onChange={e => saveSettings({ ...settings, currency: e.target.value })}
              title="Currency"
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="JOD">JOD</option>
              <option value="SAR">SAR</option>
              <option value="AED">AED</option>
            </select>
          </div>
          <div>
            <label htmlFor="settings-locale" className="block text-sm font-bold mb-1">Locale</label>
            <select
              id="settings-locale"
              className="w-full p-2 border rounded"
              value={settings.locale}
              onChange={e => saveSettings({ ...settings, locale: e.target.value })}
              title="Locale"
            >
              <option value="en-US">English (US)</option>
              <option value="en-GB">English (UK)</option>
              <option value="ar-JO">Arabic (Jordan)</option>
              <option value="ar-SA">Arabic (Saudi)</option>
            </select>
          </div>
          <div>
            <label htmlFor="settings-date-format" className="block text-sm font-bold mb-1">Date Format</label>
            <select
              id="settings-date-format"
              className="w-full p-2 border rounded"
              value={settings.dateFormat}
              onChange={e => saveSettings({ ...settings, dateFormat: e.target.value })}
              title="Date format"
            >
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
            </select>
          </div>
          <div>
            <label htmlFor="settings-budget-period" className="block text-sm font-bold mb-1">Default Budget Period</label>
            <select
              id="settings-budget-period"
              className="w-full p-2 border rounded"
              value={settings.defaultBudgetPeriod}
              onChange={e => saveSettings({ ...settings, defaultBudgetPeriod: e.target.value })}
              title="Default budget period"
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
          <div>
            <label htmlFor="settings-default-account" className="block text-sm font-bold mb-1">Default Account</label>
            <select
              id="settings-default-account"
              className="w-full p-2 border rounded"
              value={settings.defaultAccountId}
              onChange={e => saveSettings({ ...settings, defaultAccountId: e.target.value })}
              title="Default account"
            >
              <option value="">None</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="settings-default-category" className="block text-sm font-bold mb-1">Default Category</label>
            <select
              id="settings-default-category"
              className="w-full p-2 border rounded"
              value={settings.defaultCategoryId}
              onChange={e => saveSettings({ ...settings, defaultCategoryId: e.target.value })}
              title="Default category"
            >
              <option value="">None</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="card mb-8">
        <h3 className="text-xl mb-4 font-bold">Privacy & Notifications</h3>
        <div className="space-y-4">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.autoHideBalances}
              onChange={e => saveSettings({ ...settings, autoHideBalances: e.target.checked })}
            />
            <span>Auto-hide balances on startup</span>
          </label>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.enableNotifications}
              onChange={e => saveSettings({ ...settings, enableNotifications: e.target.checked })}
            />
            <span>Enable notifications</span>
          </label>
          <div>
            <label htmlFor="settings-backup-reminder" className="block text-sm font-bold mb-1">Backup Reminder (days)</label>
            <input
              id="settings-backup-reminder"
              type="number"
              min={1}
              className="w-full p-2 border rounded"
              value={settings.backupReminderDays}
              onChange={e => saveSettings({ ...settings, backupReminderDays: Number(e.target.value) })}
              title="Backup reminder days"
            />
          </div>
        </div>
      </div>

        <div className="card">
            <h3 className="text-xl mb-4 font-bold">Categories</h3>
            
            <form onSubmit={handleAddCategory} className="flex gap-4 mb-6 p-4 bg-gray-50 rounded-lg border border-dashed border-gray-300 items-end">
                <div className="flex-1">
                <label htmlFor="settings-category-name" className="block text-sm font-bold mb-1">Name</label>
                    <input 
                        required
                  id="settings-category-name"
                        className="w-full p-2 border rounded"
                        value={newCat.name}
                        onChange={e => setNewCat({...newCat, name: e.target.value})}
                        placeholder="New Category..."
                    />
                </div>
                <div className="w-[120px]">
                <label htmlFor="settings-category-type" className="block text-sm font-bold mb-1">Type</label>
                    <select 
                  id="settings-category-type"
                        className="w-full p-2 border rounded"
                        value={newCat.type}
                        onChange={e => setNewCat({...newCat, type: e.target.value})}
                    >
                        <option value="expense">Expense</option>
                        <option value="income">Income</option>
                    </select>
                </div>
              <div>
                 <label htmlFor="settings-category-color" className="block text-sm font-bold mb-1">Color</label>
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
                    <PlusCircle size={20} /> Add
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
                      aria-label={`Delete category ${cat.name}`}
                      title={`Delete category ${cat.name}`}
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
