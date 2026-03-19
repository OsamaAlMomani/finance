import { useEffect, useState } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { TitleBar } from './components/TitleBar';
import { applyTheme } from './utils/theme';
import { Dashboard } from './pages/Dashboard';
import { Settings } from './pages/Settings';
import { Transactions } from './pages/Transactions';
import { BudgetPage } from './pages/Budget';
import { GoalsPage } from './pages/Goals';
import { BillsPage } from './pages/Bills';
import { LoansPage } from './pages/Loans';
import { ImportExportPage } from './pages/ImportExport';
import { PlansPage } from './pages/Plans';
import { UsersPage } from './pages/Users';
import { ScenariosPage } from './pages/Scenarios';
import { AlertsPage } from './pages/Alerts';
import { SettlementPage } from './pages/Settlement';
import { ReportsPage } from './pages/Reports';
import { SharingPage } from './pages/Sharing';
import { SystemStateBar } from './components/SystemStateBar';
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

const App = () => {
  const [appReady, setAppReady] = useState<boolean>(false);
  const [hasActiveUser, setHasActiveUser] = useState<boolean>(false);
  const [currentUserName, setCurrentUserName] = useState<string>('');
  const { t } = useI18n();

  useEffect(() => {
    localStorage.setItem('theme', 'dark');
    applyTheme('dark');
  }, []);

  useEffect(() => {
    let cancelled = false;

    const bootstrapUser = async () => {
      if (!window.electron?.invoke) {
        if (!cancelled) {
          setHasActiveUser(false);
          setAppReady(true);
        }
        return;
      }

      try {
        const data = await window.electron.invoke('user-get-all');
        if (cancelled) return;

        const authUserId = localStorage.getItem('authUserId');
        const selectedUser: UserMeta | undefined =
          data?.users?.find((u: UserMeta) => u.id === authUserId) ||
          data?.users?.find((u: UserMeta) => u.id === data?.activeUserId) ||
          data?.users?.[0];

        if (!selectedUser?.id) {
          setHasActiveUser(false);
          setCurrentUserName('');
          return;
        }

        localStorage.setItem('authUserId', selectedUser.id);
        if (selectedUser.id !== data?.activeUserId) {
          await window.electron.invoke('user-set-active', selectedUser.id);
        }

        setCurrentUserName(selectedUser.name || '');
        setHasActiveUser(true);
      } catch {
        if (!cancelled) {
          setHasActiveUser(false);
          setCurrentUserName('');
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
    let cancelled = false;

    if (!appReady || !hasActiveUser || !window.electron?.invoke) {
      clearLabCssFromDom();
      return;
    }

    const syncLabProfileCss = async () => {
      try {
        const data = await window.electron.invoke('user-get-all');
        if (cancelled) return;

        const authUserId = localStorage.getItem('authUserId');
        const activeUser: UserMeta | undefined =
          data?.users?.find((u: UserMeta) => u.id === authUserId) ||
          data?.users?.find((u: UserMeta) => u.id === data?.activeUserId);

        const activeProfile =
          activeUser?.profiles?.find((profile) => profile.id === activeUser?.activeProfileId) ||
          activeUser?.profiles?.[0];

        if (!activeUser?.id || !activeProfile?.id) {
          clearLabCssFromDom();
          return;
        }

        localStorage.setItem('activeUserId', activeUser.id);
        localStorage.setItem('activeProfileId', activeProfile.id);
        localStorage.setItem('activeProfileIsLab', activeProfile.isLab ? '1' : '0');

        applyStoredLabCssForProfile(activeUser.id, activeProfile.id, Boolean(activeProfile.isLab));
      } catch {
        clearLabCssFromDom();
      }
    };

    void syncLabProfileCss();

    return () => {
      cancelled = true;
    };
  }, [appReady, hasActiveUser]);

  useEffect(() => {
    if (!window.electron?.on) return;
    const offTests = window.electron.on('app:run-tests', () => {
      alert(t('app.testShortcut'));
    });
    const offAbout = window.electron.on('app:show-about', () => {
      alert(t('app.aboutTitle'));
    });
    return () => {
      if (offTests) offTests();
      if (offAbout) offAbout();
    };
  }, [t]);

  return (
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <div className="app-container">
        <TitleBar userName={currentUserName} />
        {!appReady ? (
          <div className="app-auth flex items-center justify-center">
            <div className="card p-6 text-center">{t('common.loading')}</div>
          </div>
        ) : !hasActiveUser ? (
          <div className="app-auth p-6">
            <UsersPage />
          </div>
        ) : (
          <div className="app-body">
            <Sidebar />
            <main className="main-content">
              <SystemStateBar />
              <div className="route-workspace">
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/settings" element={<Settings />} />
                  
                  <Route path="/transactions" element={<Transactions />} />
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
                  <Route path="/users" element={<UsersPage />} />
                  <Route path="/import-export" element={<ImportExportPage />} />
                </Routes>
              </div>
            </main>
          </div>
        )}
      </div>
    </HashRouter>
  );
};

export default App;
