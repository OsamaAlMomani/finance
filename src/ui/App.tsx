import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Overview from './sections/Overview'
import Transactions from './sections/Transactions'
import Calendar from './sections/Calendar'
import Forecast from './sections/Forecast'
import Risk from './sections/Risk'
import Budgets from './sections/Budgets'
import Tax from './sections/Tax'
import Settings from './sections/Settings'
import './App.css'

function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Overview />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/forecast" element={<Forecast />} />
          <Route path="/risk" element={<Risk />} />
          <Route path="/budgets" element={<Budgets />} />
          <Route path="/tax" element={<Tax />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Router>
  )
}

export default App
