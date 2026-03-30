import { Suspense, lazy, useEffect, useState } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { TitleBar } from './components/TitleBar';
import { applyTheme } from './utils/theme';
import { useI18n } from './contexts/useI18n';
import { applyStoredLabCssForProfile, clearLabCssFromDom } from './utils/labStyle';

interface ProfileMeta {
  id: string;
  isLab?: boolean;
}

interface UserMeta {
  id: string;
  name?: string;
  activeProfileId?: string;
  profiles?: ProfileMeta[];
}

const Dashboard = lazy(async () => {
  const module = await import('./pages/Dashboard');
  return { default: module.Dashboard };
});

const Settings = lazy(async () => {
  const module = await import('./pages/Settings');
  return { default: module.Settings };
});

const Transactions = lazy(async () => {
  const module = await import('./pages/Transactions');
  return { default: module.Transactions };
});

const AccountsPage = lazy(async () => {
  const module = await import('./pages/Accounts');
  return { default: module.AccountsPage };
});

const BudgetPage = lazy(async () => {
  const module = await import('./pages/Budget');
  return { default: module.BudgetPage };
});

const GoalsPage = lazy(async () => {
  const module = await import('./pages/Goals');
  return { default: module.GoalsPage };
});

const BillsPage = lazy(async () => {
  const module = await import('./pages/Bills');
  return { default: module.BillsPage };
});

const LoansPage = lazy(async () => {
  const module = await import('./pages/Loans');
  return { default: module.LoansPage };
});

const ImportExportPage = lazy(async () => {
  const module = await import('./pages/ImportExport');
  return { default: module.ImportExportPage };
});

const PlansPage = lazy(async () => {
  const module = await import('./pages/Plans');
  return { default: module.PlansPage };
});

const ScenariosPage = lazy(async () => {
  const module = await import('./pages/Scenarios');
  return { default: module.ScenariosPage };
});

const AlertsPage = lazy(async () => {
  const module = await import('./pages/Alerts');
  return { default: module.AlertsPage };
});

const SettlementPage = lazy(async () => {
  const module = await import('./pages/Settlement');
  return { default: module.SettlementPage };
});

const ReportsPage = lazy(async () => {
  const module = await import('./pages/Reports');
  return { default: module.ReportsPage };
});

const SharingPage = lazy(async () => {
  const module = await import('./pages/Sharing');
  return { default: module.SharingPage };
});

const App = () => {
  const [appReady, setAppReady] = useState<boolean>(false);
  const [currentUserName, setCurrentUserName] = useState<string>('');
  const [activeUserId, setActiveUserId] = useState<string>('');
  const [activeProfile, setActiveProfile] = useState<ProfileMeta | null>(null);
  const [appToast, setAppToast] = useState<string>('');
  const { t } = useI18n();

  useEffect(() => {
    localStorage.setItem('theme', 'light');
    applyTheme('light');
  }, []);

  useEffect(() => {
    let cancelled = false;

    const bootstrapUser = async () => {
      if (!window.electron?.invoke) {
        if (!cancelled) {
          setAppReady(true);
        }
        return;
      }

      try {
        const data = await window.electron.invoke('user-get-all');
        if (cancelled) return;

        const selectedUser: UserMeta | undefined =
          data?.users?.find((u: UserMeta) => u.id === data?.activeUserId) ||
          data?.users?.[0];
        const selectedProfile =
          selectedUser?.profiles?.find((profile) => profile.id === selectedUser?.activeProfileId) ||
          selectedUser?.profiles?.[0] ||
          null;

        if (!selectedUser?.id) {
          setCurrentUserName('');
          setActiveUserId('');
          setActiveProfile(null);
          localStorage.removeItem('authUserId');
          localStorage.removeItem('activeUserId');
          localStorage.removeItem('activeProfileId');
          localStorage.removeItem('activeProfileIsLab');
          return;
        }

        localStorage.setItem('authUserId', selectedUser.id);
        if (selectedProfile?.id) {
          localStorage.setItem('activeProfileId', selectedProfile.id);
          localStorage.setItem('activeProfileIsLab', selectedProfile.isLab ? '1' : '0');
        } else {
          localStorage.removeItem('activeProfileId');
          localStorage.removeItem('activeProfileIsLab');
        }

        setCurrentUserName(selectedUser.name || '');
        setActiveUserId(selectedUser.id);
        setActiveProfile(selectedProfile);
      } catch {
        if (!cancelled) {
          setCurrentUserName('');
          setActiveUserId('');
          setActiveProfile(null);
          localStorage.removeItem('authUserId');
          localStorage.removeItem('activeUserId');
          localStorage.removeItem('activeProfileId');
          localStorage.removeItem('activeProfileIsLab');
        }
      } finally {
        if (!cancelled) {
          setAppReady(true);
        }
      }
    };

    void bootstrapUser();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!appReady || !activeUserId || !activeProfile?.id) {
      clearLabCssFromDom();
      return;
    }

    localStorage.setItem('activeUserId', activeUserId);
    localStorage.setItem('activeProfileId', activeProfile.id);
    localStorage.setItem('activeProfileIsLab', activeProfile.isLab ? '1' : '0');

    applyStoredLabCssForProfile(activeUserId, activeProfile.id, Boolean(activeProfile.isLab));
  }, [activeProfile, activeUserId, appReady]);

  useEffect(() => {
    if (!window.electron?.on) return;
    const offTests = window.electron.on('app:run-tests', () => {
      setAppToast(t('app.testShortcut'));
    });
    const offAbout = window.electron.on('app:show-about', () => {
      setAppToast(t('app.aboutTitle'));
    });
    return () => {
      if (offTests) offTests();
      if (offAbout) offAbout();
    };
  }, [t]);

  useEffect(() => {
    if (!appToast) return;
    const timer = window.setTimeout(() => setAppToast(''), 2600);
    return () => window.clearTimeout(timer);
  }, [appToast]);

  return (
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <div className="app-container">
        <TitleBar userName={currentUserName} />
        {appToast && (
          <div className="fixed top-16 right-4 z-50 rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 shadow-lg">
            {appToast}
          </div>
        )}
        {!appReady ? (
          <div className="app-auth flex items-center justify-center">
            <div className="card p-6 text-center">{t('common.loading')}</div>
          </div>
        ) : (
          <div className="app-body">
            <Sidebar />
            <main className="main-content">
              <div className="route-workspace">
                <Suspense fallback={<div className="card p-6 text-center">{t('common.loading')}</div>}>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/settings" element={<Settings />} />

                    <Route path="/transactions" element={<Transactions />} />
                    <Route path="/accounts" element={<AccountsPage />} />
                    <Route path="/budget" element={<BudgetPage />} />
                    <Route path="/goals" element={<GoalsPage />} />
                    <Route path="/bills" element={<BillsPage />} />
                    <Route path="/loans" element={<LoansPage />} />
                    <Route path="/plans" element={<PlansPage />} />
                    <Route path="/scenarios" element={<ScenariosPage />} />
                    <Route path="/alerts" element={<AlertsPage />} />
                    <Route path="/settlement" element={<SettlementPage />} />
                    <Route path="/reports" element={<ReportsPage />} />
                    <Route path="/sharing" element={<SharingPage />} />
                    <Route path="/import-export" element={<ImportExportPage />} />
                  </Routes>
                </Suspense>
              </div>
            </main>
          </div>
        )}
      </div>
    </HashRouter>
  );
};

export default App;
