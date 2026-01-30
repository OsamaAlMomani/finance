import { useEffect } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { Settings } from './pages/Settings';
import { Transactions } from './pages/Transactions';
import { BudgetPage } from './pages/Budget';
import { GoalsPage } from './pages/Goals';
import { BillsPage } from './pages/Bills';

const App = () => {
  useEffect(() => {
    // Load theme
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'girly') document.body.classList.add('girly-theme');
    if (savedTheme === 'men') document.body.classList.add('men-theme');
  }, []);

  return (
    <HashRouter>
      <div className="app-container">
        <Sidebar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/settings" element={<Settings />} />
            
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/budget" element={<BudgetPage />} />
            <Route path="/goals" element={<GoalsPage />} />
            <Route path="/bills" element={<BillsPage />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
};

export default App;
