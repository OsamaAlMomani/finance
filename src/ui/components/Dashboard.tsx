import { useState, createElement } from 'react'
import '../styles/Dashboard.css'
import '../styles/Tools.css'
import CashFlowTimeline from './tools/CashFlowTimeline'
import NetWorthOverTime from './tools/NetWorthOverTime'
import ExpenseBreakdown from './tools/ExpenseBreakdown'
import CumulativeSavings from './tools/CumulativeSavings'
import BurnRateRunway from './tools/BurnRateRunway'
import ForecastVsActual from './tools/ForecastVsActual'
import IncomeSourceDistribution from './tools/IncomeSourceDistribution'
import CostOfLiving from './tools/CostOfLiving'
import CalendarPlanning from './tools/CalendarPlanning'
import ScenarioPlanner from './tools/ScenarioPlanner'
import DangerSafetyMeter from './tools/DangerSafetyMeter'
import TodoList from './tools/TodoList'
import EnhancedCalendar from './tools/EnhancedCalendar'

interface Tool {
  id: string
  title: string
  description: string
  icon: string
  color: string
  component: React.ComponentType<{}>
}

const tools: Tool[] = [
  {
    id: 'cash-flow',
    title: 'Cash Flow Timeline',
    description: 'Track daily expenses and spending',
    icon: '💰',
    color: '#FF6B6B',
    component: CashFlowTimeline
  },
  {
    id: 'net-worth',
    title: 'Net Worth Over Time',
    description: 'Measures real financial health',
    icon: '📈',
    color: '#4ECDC4',
    component: NetWorthOverTime
  },
  {
    id: 'expense-breakdown',
    title: 'Expense Breakdown',
    description: 'Reveals where money actually goes',
    icon: '📊',
    color: '#45B7D1',
    component: ExpenseBreakdown
  },
  {
    id: 'cumulative-savings',
    title: 'Cumulative Savings',
    description: 'Shows progress momentum',
    icon: '📈',
    color: '#96CEB4',
    component: CumulativeSavings
  },
  {
    id: 'burn-rate',
    title: 'Burn Rate & Runway',
    description: 'Estimates how long funds will last',
    icon: '🏦',
    color: '#FFEAA7',
    component: BurnRateRunway
  },
  {
    id: 'forecast',
    title: 'Forecast vs Actual',
    description: 'Compares planning versus reality',
    icon: '📋',
    color: '#DDA15E',
    component: ForecastVsActual
  },
  {
    id: 'income-distribution',
    title: 'Income Distribution',
    description: 'Evaluates income stability',
    icon: '💱',
    color: '#BC6C25',
    component: IncomeSourceDistribution
  },
  {
    id: 'cost-of-living',
    title: 'Cost of Living',
    description: 'Adds economic context to spending',
    icon: '🎯',
    color: '#9D84B7',
    component: CostOfLiving
  },
  {
    id: 'calendar-planning',
    title: 'Calendar Planning',
    description: 'See money events on actual dates',
    icon: '📅',
    color: '#5DADE2',
    component: CalendarPlanning
  },
  {
    id: 'scenario-planner',
    title: 'Plan A / B / C',
    description: 'Simulate multiple financial futures',
    icon: '🎲',
    color: '#F39C12',
    component: ScenarioPlanner
  },
  {
    id: 'danger-meter',
    title: 'Danger & Safety Meter',
    description: 'Know your financial risk level',
    icon: '🚨',
    color: '#E74C3C',
    component: DangerSafetyMeter
  },
  {
    id: 'todo-list',
    title: 'Task Manager',
    description: 'Manage tasks with time tracking',
    icon: '✓',
    color: '#27AE60',
    component: TodoList
  },
  {
    id: 'enhanced-calendar',
    title: 'Enhanced Calendar',
    description: 'Smooth calendar with multiple views',
    icon: '📆',
    color: '#8E44AD',
    component: EnhancedCalendar
  }
]

export default function Dashboard() {
  const [selectedTool, setSelectedTool] = useState<string | null>(null)
  const selectedToolData = tools.find(t => t.id === selectedTool)

  return (
    <div className="dashboard">
      {selectedTool && selectedToolData ? (
        <div className="tool-view">
          <button className="back-btn" onClick={() => setSelectedTool(null)}>← Back to Dashboard</button>
          {selectedToolData && createElement(selectedToolData.component)}
        </div>
      ) : (
        <>
          <div className="dashboard-header">
            <h1>Finance Tools Dashboard</h1>
            <p>Manage your finances with our essential tools</p>
          </div>
          
          <div className="tools-grid">
            {tools.map((tool) => (
              <div
                key={tool.id}
                className="tool-card"
                onClick={() => setSelectedTool(tool.id)}
                style={{ borderTopColor: tool.color }}
              >
                <div className="tool-icon">{tool.icon}</div>
                <h3>{tool.title}</h3>
                <p>{tool.description}</p>
                <button 
                  className="tool-btn"
                  style={{ backgroundColor: tool.color }}
                >
                  Open Tool
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
