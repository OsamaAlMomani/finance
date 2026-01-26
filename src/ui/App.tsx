import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './components/Dashboard'
import Overview from './sections/Overview'
import Transactions from './sections/Transactions'
import Calendar from './sections/Calendar'
import Forecast from './sections/Forecast'
import Risk from './sections/Risk'
import Budgets from './sections/Budgets'
import Savings from './sections/Savings'
import SavingsEdit from './sections/SavingsEdit'
import Tax from './sections/Tax'
import Settings from './sections/Settings'
import './App.css'

function App() {
  const Router = window.location.protocol === 'file:' ? HashRouter : BrowserRouter

  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Overview />} />
          <Route path="/tools" element={<Dashboard />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/forecast" element={<Forecast />} />
          <Route path="/risk" element={<Risk />} />
          <Route path="/budgets" element={<Budgets />} />
          <Route path="/savings" element={<Savings />} />
          <Route path="/savings/edit" element={<SavingsEdit />} />
          <Route path="/tax" element={<Tax />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Router>
  )
}

export default App
