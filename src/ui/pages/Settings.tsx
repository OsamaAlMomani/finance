import { useCallback, useEffect, useState } from 'react';
import { Trash2, PlusCircle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { CATEGORY_COLOR_OPTIONS, getCategoryColorClass } from '../utils/categoryColor';
import { applyTheme } from '../utils/theme';
import {
  applyLabCss,
  clearLabCssFromDom,
  getLabCssStarterTemplate,
  type LabCssSelectorResult,
  loadLabCssForProfile,
  saveLabCssForProfile,
  testLabCss
} from '../utils/labStyle';
import { AvatarPicker } from '../components/AvatarPicker';
import { getDefaultAvatar } from '../utils/avatars';
import { useI18n } from '../contexts/useI18n';
import { LanguageSwitch } from '../components/LanguageSwitch';
import { ConfirmDialog } from '../components/ConfirmDialog';

type LabSelectorMode = 'id' | 'name' | 'class' | 'custom';
type LabStyleMode = 'text' | 'background' | 'border' | 'all';

interface Category {
  id: string;
  name: string;
  type: string;
  color: string;
  icon?: string;
}

interface ProfileMeta {
  id: string;
  name: string;
  avatar?: string | null;
  isLab?: boolean;
}

interface UserProfile {
  id: string;
  name: string;
  avatar?: string | null;
  activeProfileId?: string;
  profiles?: ProfileMeta[];
}

export const Settings = () => {
  const { t } = useI18n();
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
      const merged = { ...defaults, ...parsed };
      if (!['en-US', 'en-GB'].includes(merged.locale)) {
        merged.locale = 'en-US';
      }
      return merged;
    } catch {
      return defaults;
    }
  });
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  const [activeUser, setActiveUser] = useState<UserProfile | null>(null);
  const [activeProfile, setActiveProfile] = useState<ProfileMeta | null>(null);
  const [labCss, setLabCss] = useState('');
  const [labMessage, setLabMessage] = useState('');
  const [labSelectorMode, setLabSelectorMode] = useState<LabSelectorMode>('id');
  const [labSelectorValue, setLabSelectorValue] = useState('');
  const [labStyleMode, setLabStyleMode] = useState<LabStyleMode>('background');
  const [labStyleColor, setLabStyleColor] = useState('#8f9bab');
  const [labTestSummary, setLabTestSummary] = useState('');
  const [labTestSelectors, setLabTestSelectors] = useState<LabCssSelectorResult[]>([]);
  const [pendingDeleteCategoryId, setPendingDeleteCategoryId] = useState<string | null>(null);

  const saveSettings = (next: typeof settings) => {
    setSettings(next);
    localStorage.setItem('appSettings', JSON.stringify(next));
  };

  const refreshCategories = useCallback(async () => {
    if (window.electron) {
      const cats = await window.electron.invoke('db-get-categories');
      setCategories(cats);
    }
  }, []);

  const refreshAccounts = useCallback(async () => {
    if (!window.electron) return;
    const accs = await window.electron.invoke('db-get-accounts');
    setAccounts(accs);
  }, []);

  useEffect(() => {
    if (!window.electron) return;
    window.electron.invoke('db-get-categories').then((cats) => setCategories(cats));
    window.electron.invoke('db-get-accounts').then((accs) => setAccounts(accs));
    window.electron.invoke('user-get-all').then((data) => {
      const authUserId = localStorage.getItem('authUserId');
      const user = data.users?.find((u: UserProfile) => u.id === authUserId)
        || data.users?.find((u: UserProfile) => u.id === data.activeUserId);
      const profile = user?.profiles?.find((p: ProfileMeta) => p.id === user.activeProfileId)
        || user?.profiles?.[0]
        || null;
      setActiveUser(user || null);
      setActiveProfile(profile);
      if (user?.id && profile?.id) {
        localStorage.setItem('activeUserId', user.id);
        localStorage.setItem('activeProfileId', profile.id);
        localStorage.setItem('activeProfileIsLab', profile.isLab ? '1' : '0');
      }
      if (user?.id && profile?.id && profile.isLab) {
        const savedCss = loadLabCssForProfile(user.id, profile.id);
        setLabCss(savedCss);
        applyLabCss(savedCss);
      } else {
        setLabCss('');
        clearLabCssFromDom();
      }
      setLabMessage('');
      setLabTestSummary('');
      setLabTestSelectors([]);
    });
  }, [refreshAccounts, refreshCategories]);

  useEffect(() => {
    const onDataChanged = () => {
      void refreshCategories();
      void refreshAccounts();
    };
    window.addEventListener('finance:data-changed', onDataChanged);
    return () => window.removeEventListener('finance:data-changed', onDataChanged);
  }, [refreshAccounts, refreshCategories]);

  useEffect(() => {
    localStorage.setItem('theme', 'light');
    applyTheme('light');
  }, []);

  const handleLabCssChange = (value: string) => {
    setLabCss(value);
    if (!activeUser?.id || !activeProfile?.id || !activeProfile.isLab) return;
    saveLabCssForProfile(activeUser.id, activeProfile.id, value);
    applyLabCss(value);
    setLabMessage('');
    setLabTestSummary('');
    setLabTestSelectors([]);
  };

  const handleLabTemplate = () => {
    if (!activeUser?.id || !activeProfile?.id || !activeProfile.isLab) return;
    const template = getLabCssStarterTemplate();
    setLabCss(template);
    saveLabCssForProfile(activeUser.id, activeProfile.id, template);
    applyLabCss(template);
    setLabMessage(t('settings.designLab.templateApplied'));
    setLabTestSummary('');
    setLabTestSelectors([]);
  };

  const handleLabReset = () => {
    if (!activeUser?.id || !activeProfile?.id || !activeProfile.isLab) return;
    setLabCss('');
    saveLabCssForProfile(activeUser.id, activeProfile.id, '');
    clearLabCssFromDom();
    setLabMessage(t('settings.designLab.resetApplied'));
    setLabTestSummary('');
    setLabTestSelectors([]);
  };

  const buildLabSelector = () => {
    const raw = labSelectorValue.trim();
    if (!raw) return '';
    if (labSelectorMode === 'custom') return raw;
    if (labSelectorMode === 'id') return `#${raw.replace(/^#/, '')}`;
    if (labSelectorMode === 'class') return `.${raw.replace(/^\./, '')}`;
    const escaped = raw.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `[name="${escaped}"], [data-name="${escaped}"], [aria-label="${escaped}"]`;
  };

  const buildLabDeclarations = () => {
    const important = ' !important';
    if (labStyleMode === 'text') {
      return [
        `color: ${labStyleColor}${important};`,
        `fill: ${labStyleColor}${important};`,
        `stroke: ${labStyleColor}${important};`
      ];
    }
    if (labStyleMode === 'background') {
      return [
        `background-color: ${labStyleColor}${important};`,
        `background-image: none${important};`
      ];
    }
    if (labStyleMode === 'border') {
      return [
        `border-color: ${labStyleColor}${important};`,
        `outline-color: ${labStyleColor}${important};`
      ];
    }
    return [
      `color: ${labStyleColor}${important};`,
      `background-color: ${labStyleColor}${important};`,
      `border-color: ${labStyleColor}${important};`,
      `fill: ${labStyleColor}${important};`,
      `stroke: ${labStyleColor}${important};`
    ];
  };

  const handleLabAddRule = () => {
    if (!activeUser?.id || !activeProfile?.id || !activeProfile.isLab) return;
    const selector = buildLabSelector();
    if (!selector) {
      setLabMessage(t('settings.designLab.selectorRequired'));
      return;
    }
    const declarations = buildLabDeclarations().map((line) => `  ${line}`).join('\n');
    const nextRule = `${selector} {\n${declarations}\n}`;
    const nextCss = labCss.trim() ? `${labCss.trim()}\n\n${nextRule}` : nextRule;
    setLabCss(nextCss);
    saveLabCssForProfile(activeUser.id, activeProfile.id, nextCss);
    applyLabCss(nextCss);
    setLabMessage(t('settings.designLab.ruleApplied'));
    setLabTestSummary('');
    setLabTestSelectors([]);
  };

  const handleLabTest = () => {
    const result = testLabCss(labCss);
    if (!result.valid) {
      setLabTestSummary('');
      setLabTestSelectors([]);
      setLabMessage(t('settings.designLab.testFailed', { error: result.error || t('common.notAvailable') }));
      return;
    }

    const totalMatches = result.selectors.reduce((sum, selectorResult) => sum + selectorResult.matches, 0);
    setLabTestSummary(t('settings.designLab.testPassed', {
      rules: String(result.ruleCount),
      selectors: String(result.selectors.length),
      matches: String(totalMatches)
    }));
    setLabTestSelectors(result.selectors.slice(0, 12));
    setLabMessage('');
  };

  const handleAvatarChange = async (avatar: string) => {
    if (!window.electron || !activeUser) return;
    const data = await window.electron.invoke('user-update-avatar', activeUser.id, avatar);
    const updated = data.users?.find((u: UserProfile) => u.id === activeUser.id) || null;
    setActiveUser(updated);
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.electron) return;
    await window.electron.invoke('db-create-category', {
      id: uuidv4(),
      ...newCat,
      icon: 'circle'
    });
    setNewCat({ ...newCat, name: '' });
    refreshCategories();
  };

  const handleDeleteCategory = async (id: string) => {
    setPendingDeleteCategoryId(id);
  };

  const confirmDeleteCategory = async () => {
    const id = pendingDeleteCategoryId;
    if (!id) return;
    setPendingDeleteCategoryId(null);
    if (!window.electron) return;
    await window.electron.invoke('db-delete-category', id);
    refreshCategories();
  };

  return (
    <div className="settings-page page-shell p-6">
      <div className="max-w-5xl mx-auto">
        <div className="page-hero mb-8">
          <div className="page-copy">
            <p className="page-eyebrow">{t('sidebar.settings')}</p>
            <h2 className="page-title heading-font text-ink">{t('settings.title')}</h2>
            <p className="page-subtitle">{t('settings.subtitle')}</p>
          </div>
        </div>

        <div className="card mb-8">
          <h3 className="text-xl font-bold mb-6 text-ink">{t('settings.themeTitle')}</h3>
          <div className="flex flex-wrap gap-4">
            <button
              type="button"
              className="btn theme-select-btn active"
              disabled
            >
              {t('settings.theme.light')}
            </button>
          </div>
        </div>

        {/* Avatar Card */}
        <div className="card mb-8">
          <h3 className="text-xl font-bold mb-6 text-ink">{t('settings.avatarTitle')}</h3>
          <AvatarPicker
            label={activeUser ? t('settings.avatarLabel', { name: activeUser.name }) : t('settings.avatarFallback')}
            value={activeUser?.avatar || getDefaultAvatar()}
            onChange={handleAvatarChange}
          />
        </div>

        {/* Design Lab Card */}
        <div className="card mb-8">
          <h3 className="text-xl font-bold mb-6 text-ink">{t('settings.designLab.title')}</h3>
          {activeProfile?.isLab ? (
            <div className="space-y-6">
              <p className="text-sm text-muted">{t('settings.designLab.description')}</p>

              {/* Rule Builder Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border border-dashed border-theme rounded-lg bg-theme-surface">
                <div>
                  <label htmlFor="lab-selector-mode" className="block text-sm font-bold mb-1 text-ink">
                    {t('settings.designLab.selectorMode')}
                  </label>
                  <select
                    id="lab-selector-mode"
                    className="w-full p-2 border-theme rounded bg-theme-surface text-ink"
                    value={labSelectorMode}
                    onChange={(e) => setLabSelectorMode(e.target.value as LabSelectorMode)}
                  >
                    <option value="id">{t('settings.designLab.selectorMode.id')}</option>
                    <option value="name">{t('settings.designLab.selectorMode.name')}</option>
                    <option value="class">{t('settings.designLab.selectorMode.class')}</option>
                    <option value="custom">{t('settings.designLab.selectorMode.custom')}</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="lab-selector-value" className="block text-sm font-bold mb-1 text-ink">
                    {t('settings.designLab.selectorValue')}
                  </label>
                  <input
                    id="lab-selector-value"
                    className="w-full p-2 border-theme rounded bg-theme-surface text-ink"
                    value={labSelectorValue}
                    onChange={(e) => setLabSelectorValue(e.target.value)}
                    placeholder={t('settings.designLab.selectorPlaceholder')}
                  />
                </div>
                <div>
                  <label htmlFor="lab-style-mode" className="block text-sm font-bold mb-1 text-ink">
                    {t('settings.designLab.styleMode')}
                  </label>
                  <select
                    id="lab-style-mode"
                    className="w-full p-2 border-theme rounded bg-theme-surface text-ink"
                    value={labStyleMode}
                    onChange={(e) => setLabStyleMode(e.target.value as LabStyleMode)}
                  >
                    <option value="text">{t('settings.designLab.styleMode.text')}</option>
                    <option value="background">{t('settings.designLab.styleMode.background')}</option>
                    <option value="border">{t('settings.designLab.styleMode.border')}</option>
                    <option value="all">{t('settings.designLab.styleMode.all')}</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="lab-style-color" className="block text-sm font-bold mb-1 text-ink">
                    {t('settings.designLab.color')}
                  </label>
                  <input
                    id="lab-style-color"
                    type="color"
                    className="w-full h-[42px] p-1 border-theme rounded bg-theme-surface"
                    value={labStyleColor}
                    onChange={(e) => setLabStyleColor(e.target.value)}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                <button className="btn btn-secondary" onClick={handleLabAddRule}>
                  {t('settings.designLab.addRule')}
                </button>
                <button className="btn btn-secondary" onClick={handleLabTest}>
                  {t('settings.designLab.test')}
                </button>
                <button className="btn btn-secondary" onClick={handleLabTemplate}>
                  {t('settings.designLab.useTemplate')}
                </button>
                <button className="btn btn-secondary" onClick={handleLabReset}>
                  {t('settings.designLab.reset')}
                </button>
              </div>

              {/* CSS Editor */}
              <textarea
                className="w-full min-h-[280px] p-3 border-theme rounded bg-theme-surface text-ink font-mono text-sm"
                spellCheck={false}
                value={labCss}
                onChange={(e) => handleLabCssChange(e.target.value)}
                placeholder={t('settings.designLab.placeholder')}
              />
              <p className="text-xs text-muted">{t('settings.designLab.hint')}</p>
              {labTestSummary && (
                <p className="text-xs text-theme-info">{labTestSummary}</p>
              )}
              {labTestSelectors.length > 0 && (
                <div className="rounded-lg border border-dashed border-theme p-3 max-h-44 overflow-y-auto">
                  <p className="text-xs font-bold text-ink mb-2">{t('settings.designLab.selectorResults')}</p>
                  <div className="space-y-1">
                    {labTestSelectors.map((selectorResult) => (
                      <div key={selectorResult.selector} className="flex items-start justify-between gap-3 text-xs">
                        <code className="text-ink break-all">{selectorResult.selector}</code>
                        <span className={selectorResult.queryable ? 'text-theme-success' : 'text-theme-warning'}>
                          {selectorResult.queryable
                            ? t('settings.designLab.selectorMatches', { count: String(selectorResult.matches) })
                            : t('settings.designLab.selectorUnqueryable')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {labMessage && <p className="text-xs text-theme-success">{labMessage}</p>}
            </div>
          ) : (
            <p className="text-sm text-muted">{t('settings.designLab.onlyLab')}</p>
          )}
        </div>

        {/* General Settings Card */}
        <div className="card mb-8">
          <h3 className="text-xl font-bold mb-6 text-ink">{t('settings.generalTitle')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <LanguageSwitch />
            <div>
              <label htmlFor="currency" className="block text-sm font-bold mb-1 text-ink">{t('settings.currency')}</label>
              <select
                id="currency"
                className="w-full p-2 border-theme rounded bg-theme-surface text-ink"
                value={settings.currency}
                onChange={e => saveSettings({ ...settings, currency: e.target.value })}
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
              <label htmlFor="locale" className="block text-sm font-bold mb-1 text-ink">{t('settings.locale')}</label>
              <select
                id="locale"
                className="w-full p-2 border-theme rounded bg-theme-surface text-ink"
                value={settings.locale}
                onChange={e => saveSettings({ ...settings, locale: e.target.value })}
              >
                <option value="en-US">{t('settings.locale.enUS')}</option>
                <option value="en-GB">{t('settings.locale.enGB')}</option>
              </select>
            </div>
            <div>
              <label htmlFor="dateFormat" className="block text-sm font-bold mb-1 text-ink">{t('settings.dateFormat')}</label>
              <select
                id="dateFormat"
                className="w-full p-2 border-theme rounded bg-theme-surface text-ink"
                value={settings.dateFormat}
                onChange={e => saveSettings({ ...settings, dateFormat: e.target.value })}
              >
                <option value="YYYY-MM-DD">{t('settings.dateFormatOption.ymd')}</option>
                <option value="DD/MM/YYYY">{t('settings.dateFormatOption.dmy')}</option>
                <option value="MM/DD/YYYY">{t('settings.dateFormatOption.mdy')}</option>
              </select>
            </div>
            <div>
              <label htmlFor="budgetPeriod" className="block text-sm font-bold mb-1 text-ink">{t('settings.defaultBudgetPeriod')}</label>
              <select
                id="budgetPeriod"
                className="w-full p-2 border-theme rounded bg-theme-surface text-ink"
                value={settings.defaultBudgetPeriod}
                onChange={e => saveSettings({ ...settings, defaultBudgetPeriod: e.target.value })}
              >
                <option value="weekly">{t('settings.period.weekly')}</option>
                <option value="monthly">{t('settings.period.monthly')}</option>
                <option value="yearly">{t('settings.period.yearly')}</option>
              </select>
            </div>
            <div>
              <label htmlFor="defaultAccount" className="block text-sm font-bold mb-1 text-ink">{t('settings.defaultAccount')}</label>
              <select
                id="defaultAccount"
                className="w-full p-2 border-theme rounded bg-theme-surface text-ink"
                value={settings.defaultAccountId}
                onChange={e => saveSettings({ ...settings, defaultAccountId: e.target.value })}
              >
                <option value="">{t('settings.none')}</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="defaultCategory" className="block text-sm font-bold mb-1 text-ink">{t('settings.defaultCategory')}</label>
              <select
                id="defaultCategory"
                className="w-full p-2 border-theme rounded bg-theme-surface text-ink"
                value={settings.defaultCategoryId}
                onChange={e => saveSettings({ ...settings, defaultCategoryId: e.target.value })}
              >
                <option value="">{t('settings.none')}</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Privacy Settings Card */}
        <div className="card mb-8">
          <h3 className="text-xl font-bold mb-6 text-ink">{t('settings.privacyTitle')}</h3>
          <div className="space-y-4">
            <label className="flex items-center gap-3 text-ink">
              <input
                type="checkbox"
                checked={settings.autoHideBalances}
                onChange={e => saveSettings({ ...settings, autoHideBalances: e.target.checked })}
                className="accent-theme-primary"
              />
              <span>{t('settings.autoHideBalances')}</span>
            </label>
            <label className="flex items-center gap-3 text-ink">
              <input
                type="checkbox"
                checked={settings.enableNotifications}
                onChange={e => saveSettings({ ...settings, enableNotifications: e.target.checked })}
                className="accent-theme-primary"
              />
              <span>{t('settings.enableNotifications')}</span>
            </label>
            <div>
              <label htmlFor="backupReminder" className="block text-sm font-bold mb-1 text-ink">{t('settings.backupReminder')}</label>
              <input
                id="backupReminder"
                type="number"
                min={1}
                className="w-full p-2 border-theme rounded bg-theme-surface text-ink"
                value={settings.backupReminderDays}
                onChange={e => saveSettings({ ...settings, backupReminderDays: Number(e.target.value) })}
              />
            </div>
          </div>
        </div>

        {/* Categories Management Card */}
        <div className="card">
          <h3 className="text-xl font-bold mb-6 text-ink">{t('settings.categoriesTitle')}</h3>

          {/* Add Category Form */}
          <form onSubmit={handleAddCategory} className="flex flex-wrap gap-4 mb-8 p-4 border border-dashed border-theme rounded-lg bg-theme-surface items-end">
            <div className="flex-1 min-w-[200px]">
              <label htmlFor="newCatName" className="block text-sm font-bold mb-1 text-ink">{t('settings.categoryName')}</label>
              <input
                id="newCatName"
                required
                className="w-full p-2 border-theme rounded bg-theme-surface text-ink"
                value={newCat.name}
                onChange={e => setNewCat({ ...newCat, name: e.target.value })}
                placeholder={t('settings.categoryPlaceholder')}
              />
            </div>
            <div className="w-[140px]">
              <label htmlFor="newCatType" className="block text-sm font-bold mb-1 text-ink">{t('settings.categoryType')}</label>
              <select
                id="newCatType"
                className="w-full p-2 border-theme rounded bg-theme-surface text-ink"
                value={newCat.type}
                onChange={e => setNewCat({ ...newCat, type: e.target.value })}
              >
                <option value="expense">{t('settings.categoryExpense')}</option>
                <option value="income">{t('settings.categoryIncome')}</option>
              </select>
            </div>
            <div className="w-[140px]">
              <label htmlFor="newCatColor" className="block text-sm font-bold mb-1 text-ink">{t('settings.categoryColor')}</label>
              <div className="flex items-center gap-2">
                <select
                  id="newCatColor"
                  className="flex-1 p-2 border-theme rounded bg-theme-surface text-ink"
                  value={newCat.color}
                  onChange={e => setNewCat({ ...newCat, color: e.target.value })}
                >
                  {CATEGORY_COLOR_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <div className={`w-8 h-8 rounded-full border ${getCategoryColorClass(newCat.color)} category-color-swatch`} />
              </div>
            </div>
            <button type="submit" className="btn btn-secondary flex items-center gap-2 h-[42px]">
              <PlusCircle size={20} /> {t('settings.categoryAdd')}
            </button>
          </form>

          {/* Categories Grid */}
          {categories.length === 0 ? (
            <p className="text-center text-muted py-8">{t('settings.noCategories')}</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories.map(cat => (
                <div key={cat.id} className="flex items-center justify-between p-4 border border-theme rounded-lg bg-theme-surface hover:shadow-theme transition-shadow">
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full ${getCategoryColorClass(cat.color)} category-color-swatch`} />
                    <div>
                      <p className="font-bold text-ink">{cat.name}</p>
                      <p className="text-xs text-muted uppercase">{cat.type}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteCategory(cat.id)}
                    className="text-muted hover:text-theme-error transition-colors"
                    aria-label={t('settings.categoryDeleteAria', { name: cat.name })}
                    title={t('settings.categoryDeleteAria', { name: cat.name })}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <ConfirmDialog
          open={Boolean(pendingDeleteCategoryId)}
          title={t('common.delete')}
          message={t('settings.categoryDeleteConfirm')}
          destructive
          onCancel={() => setPendingDeleteCategoryId(null)}
          onConfirm={() => {
            void confirmDeleteCategory();
          }}
        />
      </div>
    </div>
  );
};
