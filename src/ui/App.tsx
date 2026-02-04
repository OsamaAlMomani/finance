import { useEffect, useState } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { TitleBar } from './components/TitleBar';
import { applyTheme } from './utils/theme';
import type { ThemeKey } from './utils/theme';
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
import { AuthPage } from './pages/Auth';
import { ProfileSelectPage } from './pages/ProfileSelect';

const App = () => {
  const [loggedIn, setLoggedIn] = useState<boolean>(false);
  const [profileReady, setProfileReady] = useState<boolean>(false);
  const [currentUserName, setCurrentUserName] = useState<string>('');

  useEffect(() => {
    // Load theme
    const savedTheme = (localStorage.getItem('theme') as ThemeKey) || 'default';
    applyTheme(savedTheme);
  }, []);

  useEffect(() => {
    if (!window.electron?.on) return;
    const offTests = window.electron.on('app:run-tests', () => {
      alert('Test shortcut triggered.');
    });
    const offAbout = window.electron.on('app:show-about', () => {
      alert('SketchBoard Finance Pro');
    });
    return () => {
      if (offTests) offTests();
      if (offAbout) offAbout();
    };
  }, []);

  return (
    <HashRouter>
      <div className="app-container">
        <TitleBar userName={currentUserName} />
        {!loggedIn ? (
          <div className="app-auth">
            <AuthPage onLoggedIn={(name) => { setCurrentUserName(name); setLoggedIn(true); setProfileReady(false); }} />
          </div>
        ) : !profileReady ? (
          <div className="app-auth">
            <ProfileSelectPage onSelected={() => setProfileReady(true)} />
          </div>
        ) : (
          <div className="app-body">
            <Sidebar />
            <main className="main-content">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/settings" element={<Settings />} />
                
                <Route path="/transactions" element={<Transactions />} />
                <Route path="/budget" element={<BudgetPage />} />
                <Route path="/goals" element={<GoalsPage />} />
                <Route path="/bills" element={<BillsPage />} />
                <Route path="/loans" element={<LoansPage />} />
                <Route path="/plans" element={<PlansPage />} />
                <Route path="/users" element={<UsersPage />} />
                <Route path="/import-export" element={<ImportExportPage />} />
              </Routes>
            </main>
          </div>
        )}
      </div>
    </HashRouter>
  );
};

export default App;
