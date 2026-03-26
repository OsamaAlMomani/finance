import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import App from './App.tsx'
import { I18nProvider } from './contexts/I18nContext'
import { queryClient } from './query/queryClient'
import { FinanceDataSync } from './components/FinanceDataSync'
import './styles/index.scss'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider>
      <QueryClientProvider client={queryClient}>
        <FinanceDataSync />
        <App />
      </QueryClientProvider>
    </I18nProvider>
  </React.StrictMode>,
)
