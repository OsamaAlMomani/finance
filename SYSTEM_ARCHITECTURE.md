# Advanced Finance Dashboard - System Architecture

## 🏛️ Complete System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FINANCE DASHBOARD - SYSTEM ARCHITECTURE                   │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                           USER INTERFACE LAYER                               │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                      Dashboard.tsx (Main)                             │   │
│  │  - Tool Grid Display                                                 │   │
│  │  - Tool Selection                                                    │   │
│  │  - View Switching                                                    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│           │                     │                      │                     │
│           ▼                     ▼                      ▼                     │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────────────────┐      │
│  │  TodoList.tsx  │  │ Enhanced       │  │  [11 Existing Tools]    │      │
│  │  (NEW)         │  │ Calendar.tsx   │  │  - CashFlow             │      │
│  │  280+ lines    │  │ (NEW)          │  │  - NetWorth             │      │
│  │  ✨ Task Mgmt  │  │ 350+ lines     │  │  - Expenses             │      │
│  │  ✨ Time Track │  │ ✨ 3 Views     │  │  - Income               │      │
│  │  ✨ Priorities │  │ ✨ Events      │  │  - Forecasts            │      │
│  │  ✨ Subtasks   │  │ ✨ Recurring   │  │  - Scenarios            │      │
│  └────────────────┘  └────────────────┘  └──────────────────────────┘      │
│           │                     │                                            │
└───────────┼─────────────────────┼────────────────────────────────────────────┘
            │                     │
            └─────────────────────┴────────────────┐
                                                    │
┌───────────────────────────────────────────────────▼─────────────────────────┐
│                          HOOKS LAYER (React State)                           │
├──────────────────────────────────────────────────────────────────────────────┤
│                   useAdvancedFeatures.ts (NEW - 326 lines)                   │
│                                                                               │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐           │
│  │   useTodos()     │  │ useDashboardConf │  │ useAnalytics()   │           │
│  │                  │  │                  │  │                  │           │
│  │ • Add todo       │  │ • Get config     │  │ • Get metrics    │           │
│  │ • Get todos      │  │ • Save config    │  │ • Add metric     │           │
│  │ • Update todo    │  │ • Tool settings  │  │ • Filter data    │           │
│  │ • Delete todo    │  │ • Layout prefs   │  │ • Category org   │           │
│  │ • Real-time sync │  │ • Real-time sync │  │ • Real-time sync │           │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘           │
│                                                                               │
│  ┌──────────────────┐  ┌────────────────────────────────────────┐           │
│  │  useAlerts()     │  │  Additional Hooks Planned              │           │
│  │                  │  │  • useRecurringEvents()                │           │
│  │ • Get alerts     │  │  • useTaskNotifications()              │           │
│  │ • Create alert   │  │  • useMetricsVisualization()           │           │
│  │ • Update alert   │  │                                        │           │
│  │ • Delete alert   │  └────────────────────────────────────────┘           │
│  │ • Real-time sync │                                                       │
│  └──────────────────┘                                                       │
│                                                                               │
└───────────┬─────────────────────────────────────────────────────────────────┘
            │
            ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                        IPC COMMUNICATION LAYER                                │
├───────────────────────────────────────────────────────────────────────────────┤
│                    ipcHandlers.ts (NEW - 12 channels added)                  │
│                                                                               │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌──────────────────────┐ │
│  │  TODO HANDLERS      │  │ CONFIG HANDLERS     │  │ ANALYTICS HANDLERS   │ │
│  │                     │  │                     │  │                      │ │
│  │ • add-todo          │  │ • get-dashboard-cfg │  │ • get-analytics      │ │
│  │ • get-todos         │  │ • save-dashboard-cfg│  │ • add-analytics      │ │
│  │ • update-todo       │  │                     │  │                      │ │
│  │ • delete-todo       │  │ → Broadcast updates │  │ → Broadcast updates  │ │
│  │                     │  │                     │  │                      │ │
│  │ → Broadcast updates │  └─────────────────────┘  └──────────────────────┘ │
│  └─────────────────────┘                                                     │
│                                                                               │
│  ┌──────────────────────┐  ┌─────────────────────────────────────────────┐  │
│  │  ALERT HANDLERS      │  │  Existing Handlers (Not Modified)          │  │
│  │                      │  │  • Transaction handlers                    │  │
│  │ • get-alerts         │  │  • NetWorth handlers                       │  │
│  │ • create-alert       │  │  • Expense handlers                        │  │
│  │ • update-alert       │  │  • Income handlers                         │  │
│  │ • delete-alert       │  │  • Forecast handlers                       │  │
│  │                      │  │  • Calendar handlers                       │  │
│  │ → Broadcast updates  │  │  • Settings handlers                       │  │
│  └──────────────────────┘  └─────────────────────────────────────────────┘  │
│                                                                               │
└───────────────────────────────────────────┬───────────────────────────────────┘
                                            │
                                            ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                        DATABASE LAYER (SQLite3)                               │
├───────────────────────────────────────────────────────────────────────────────┤
│                    database.ts (Extended with 4 new tables)                  │
│                                                                               │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    DATABASE TABLES                                    │   │
│  │                                                                       │   │
│  │  NEW TABLES                          │  EXISTING TABLES             │   │
│  │  ─────────────────────────────────   │  ──────────────────────────  │   │
│  │  • todos (tasks)                      │  • transactions (cash flow)  │   │
│  │    - id, title, description           │  • net_worth_entries         │   │
│  │    - dueDate, priority, category      │  • expenses                  │   │
│  │    - completed, estimatedHours        │  • income_sources            │   │
│  │    - actualHours, subtasks            │  • forecasts                 │   │
│  │    - createdAt, updatedAt             │  • calendar_events           │   │
│  │                                       │  • settings                  │   │
│  │  • dashboard_config (settings)        │                              │   │
│  │    - id, toolIds, toolSettings        │  OPTIMIZATION               │   │
│  │    - theme, layout, updatedAt         │  ──────────────────────────  │   │
│  │                                       │  • Indexed primary keys      │   │
│  │  • analytics (metrics)                 │  • Foreign key constraints   │   │
│  │    - id, date, metric, value          │  • Transaction support       │   │
│  │    - category, createdAt              │  • PRAGMA foreign_keys ON    │   │
│  │                                       │                              │   │
│  │  • alerts (notifications)              │                              │   │
│  │    - id, type, title, message         │                              │   │
│  │    - threshold, metric, active        │                              │   │
│  │    - createdAt, updatedAt             │                              │   │
│  │                                       │                              │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                               │
│  CRUD OPERATIONS BY TABLE                                                   │
│  ─────────────────────────                                                   │
│                                                                               │
│  Todos: addTodo, getTodos, updateTodo, deleteTodo (+ subtask support)       │
│  Config: getDashboardConfig, saveDashboardConfig                            │
│  Analytics: getAnalytics, addAnalytics                                      │
│  Alerts: getAlerts, createAlert, updateAlert, deleteAlert                   │
│                                                                               │
│  TOTAL: 15+ new database functions (all exported)                           │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Data Flow Diagrams

### Task Creation Flow
```
User                Component              Hook                IPC              Database
  │                    │                    │                   │                  │
  ├─── Click "Add" ───>│                    │                   │                  │
  │                    ├── useTodos() ─────>│                   │                  │
  │                    │                    ├─ add-todo ──────> │                  │
  │                    │                    │                   ├─ Insert row ───>│
  │                    │                    │                   │<─ Return ID ────┤
  │                    │<─ Return todo ────┤                   │                  │
  │                    ├─ Broadcast ──────────────────────────>│                  │
  │                    │ todos-updated                          │                  │
  │<─ Task appears ───┤                    │                   │                  │
  │                    │                    │                   │                  │
```

### Calendar Event View Flow
```
User                Component              Hook                IPC              Database
  │                    │                    │                   │                  │
  ├─ Switch Month ────>│                    │                   │                  │
  │                    ├─ useCalendar ────>│                   │                  │
  │                    │ or IPC direct      ├─ get-todos ─────> │                  │
  │                    │                    │                   ├─ Query rows ───>│
  │                    │                    │                   │<─ Return data ──┤
  │                    │<─ Return events ──┤                   │                  │
  │                    ├─ Render month view                     │                  │
  │<─ Calendar shown ─┤                    │                   │                  │
  │                    │                    │                   │                  │
```

### Real-Time Sync Flow
```
Client 1             IPC Bridge           Client 2
(Window 1)           (Electron)           (Window 2)
   │                    │                    │
   ├─ Update todo ─────>│                    │
   │   (add-todo)       ├─ broadcastUpdate ─>│
   │                    │   (todos-updated)  ├─ Refresh hooks
   │                    │                    │
   │                    │                    ├─ useTodos() re-fetches
   │<─ Real-time update <─ listeners triggered
   │                    │
```

---

## 🎯 Feature Architecture

### Task Management System
```
TodoList Component
├── State Management (useTodos hook)
│   ├── todos: TodoItem[]
│   ├── filter: 'all' | 'active' | 'completed'
│   ├── sortBy: 'dueDate' | 'priority' | 'created'
│   └── selectedTodo: TodoItem | null
│
├── UI Sections
│   ├── Task Statistics
│   │   ├── Total tasks count
│   │   ├── Completed count
│   │   ├── Progress percentage
│   │   └── Overdue count
│   │
│   ├── Task Creation Form
│   │   ├── Title input
│   │   ├── Description textarea
│   │   ├── Due date picker
│   │   ├── Due time picker
│   │   ├── Priority selector (3 levels)
│   │   ├── Category selector (5 options)
│   │   └── Estimated hours input
│   │
│   ├── Task Filters
│   │   ├── All tasks
│   │   ├── Active tasks
│   │   └── Completed tasks
│   │
│   ├── Task Sorters
│   │   ├── Sort by due date
│   │   ├── Sort by priority
│   │   └── Sort by created date
│   │
│   └── Task List
│       ├── Task Item
│       │   ├── Title + Description
│       │   ├── Due date/time display
│       │   ├── Priority badge
│       │   ├── Progress bar (subtasks)
│       │   ├── Completion checkbox
│       │   ├── Time tracking display
│       │   ├── Overdue indicator
│       │   └── Action buttons (edit/delete)
│       │
│       └── Task Details (Expanded)
│           ├── Subtasks section
│           ├── Add new subtask form
│           ├── Subtask list with checkboxes
│           ├── Time tracking (estimated vs actual)
│           ├── Category badge
│           ├── Full description
│           └── Delete button
│
└── Data Persistence
    └── Database (todos table)
```

### Calendar System
```
EnhancedCalendar Component
├── State Management
│   ├── currentMonth: Date
│   ├── currentView: 'month' | 'week' | 'list'
│   ├── events: CalendarEvent[]
│   ├── selectedDate: Date | null
│   └── showEventForm: boolean
│
├── Views
│   ├── Month View
│   │   ├── Calendar grid (7 columns, 6 rows)
│   │   ├── Day cells with dates
│   │   ├── Event dots indicator
│   │   ├── Today highlight
│   │   ├── Navigation (prev/next month)
│   │   └── Monthly summary card
│   │       ├── Total income
│   │       ├── Total expenses
│   │       └── Net value
│   │
│   ├── Week View
│   │   ├── 7-day view
│   │   ├── Hours grid
│   │   ├── Event positioning
│   │   └── Navigation (prev/next week)
│   │
│   └── List View
│       ├── All events sorted by date
│       ├── Event details per row
│       ├── Type indicator (income/expense)
│       ├── Amount display
│       ├── Description
│       └── Date/time info
│
├── Event Management
│   ├── Event Creation Form
│   │   ├── Date picker
│   │   ├── Amount input
│   │   ├── Type selector (income/expense)
│   │   ├── Description input
│   │   ├── Recurring selector
│   │   │   ├── Once
│   │   │   ├── Weekly
│   │   │   ├── Monthly
│   │   │   └── Yearly
│   │   └── Save button
│   │
│   ├── Event Display
│   │   ├── Visual indicators on calendar
│   │   ├── Color coding by type
│   │   ├── Amount display
│   │   └── Hover information
│   │
│   └── Event Actions
│       ├── Add event
│       ├── View event details
│       ├── Edit event
│       └── Delete event
│
└── Data Persistence
    └── Database (calendar_events table extended)
```

### Analytics System
```
Analytics Tracking
├── Data Collection
│   ├── Automatic tracking
│   │   ├── Task completion metrics
│   │   ├── Time tracking data
│   │   └── Financial metrics
│   │
│   └── Manual entry
│       ├── Custom metrics
│       ├── Category data
│       └── Period data
│
├── Storage
│   ├── Date-based organization
│   ├── Category classification
│   ├── Metric naming
│   └── Value storage
│
├── Retrieval
│   ├── By date range
│   ├── By category
│   ├── By metric type
│   └── Aggregation options
│
└── Visualization (Future)
    ├── Line charts
    ├── Bar charts
    ├── Pie charts
    └── Custom dashboards
```

### Alert System
```
Alerts Management
├── Alert Types
│   ├── Threshold alerts
│   │   ├── Spending limit exceeded
│   │   ├── Income target met
│   │   └── Custom thresholds
│   │
│   ├── Milestone alerts
│   │   ├── Savings goal reached
│   │   ├── Net worth target
│   │   └── Custom milestones
│   │
│   └── Reminder alerts
│       ├── Task deadlines
│       ├── Bill payments
│       └── Custom reminders
│
├── Configuration
│   ├── Alert type selection
│   ├── Metric to monitor
│   ├── Threshold/value setting
│   ├── Active/inactive toggle
│   └── Persistence
│
├── Notifications
│   ├── Real-time tracking
│   ├── Threshold checking
│   ├── Alert triggering
│   └── User notification (Future)
│
└── Management
    ├── View all alerts
    ├── Create new alert
    ├── Edit alert settings
    └── Delete alert
```

---

## 🔌 IPC Channel Summary

### Todo Channels
- **add-todo** - Create new task
- **get-todos** - Retrieve all tasks
- **update-todo** - Modify task
- **delete-todo** - Remove task

### Config Channels
- **get-dashboard-config** - Retrieve configuration
- **save-dashboard-config** - Save configuration

### Analytics Channels
- **get-analytics** - Retrieve metrics
- **add-analytics** - Record metric

### Alert Channels
- **get-alerts** - Retrieve alerts
- **create-alert** - Create alert
- **update-alert** - Modify alert
- **delete-alert** - Remove alert

### Broadcast Events
- **todos-updated** - Task data changed
- **dashboard-config-updated** - Configuration changed
- **analytics-updated** - Metrics changed
- **alerts-updated** - Alerts changed

---

## 📦 TypeScript Type System

### Core Interfaces
```typescript
interface TodoItem {
  id: string
  title: string
  description: string
  dueDate: string
  dueTime?: string
  priority: 'high' | 'medium' | 'low'
  category: 'General' | 'Work' | 'Personal' | 'Financial' | 'Health'
  completed: boolean
  estimatedHours: number
  actualHours?: number
  subtasks: TodoSubtask[]
  createdAt: string
  updatedAt: string
}

interface DashboardConfig {
  id?: string
  toolIds: string[]
  toolSettings: Record<string, any>
  theme?: string
  layout?: 'grid' | 'list'
  updatedAt?: string
}

interface AnalyticsData {
  id?: string
  date: string
  metric: string
  value: number
  category?: string
  createdAt?: string
}

interface Alert {
  id: string
  type: 'threshold' | 'milestone' | 'reminder'
  title: string
  message: string
  threshold?: number
  metric: string
  active: boolean
  createdAt: string
  updatedAt: string
}
```

---

## 🎨 Styling Architecture

### Dark Theme Colors
```
Primary Background:    #1a1a2e
Secondary Background:  #2a2a4e
Accent Blue:          #64b5f6
Text Primary:         #ffffff
Text Secondary:       #b0bec5

Component Specific:
Task Manager Green:   #27AE60
Calendar Purple:      #8E44AD
```

### CSS Structure
```
TodoList.css (450+ lines)
├── Layout
├── Form controls
├── Task items
├── Priority badges
├── Progress bars
├── Filter buttons
├── Sort controls
└── Responsive design

EnhancedCalendar.css (500+ lines)
├── Calendar grid
├── Day cells
├── Event indicators
├── Monthly summary
├── View selectors
├── Modal forms
├── Navigation controls
└── Responsive design
```

---

## 🚀 Deployment Architecture

### Build Process
```
Source Code
   ↓
TypeScript Compilation
   ├── Type checking
   ├── Output JavaScript
   └── Checks for errors
   ↓
Vite Build
   ├── Bundles React
   ├── Optimizes CSS
   ├── Minifies code
   └── Creates dist
   ↓
Electron Packaging
   ├── Includes built assets
   ├── Bundles Node modules
   ├── Creates executable
   └── Ready for deployment
```

### Runtime Environment
```
Electron Process
├── Main Process (Node.js)
│   ├── IPC Server
│   ├── Database Connection
│   ├── File System Access
│   └── System Integration
│
└── Renderer Process (Chromium)
    ├── React Application
    ├── UI Rendering
    ├── State Management
    └── User Interaction
```

---

## 📊 Statistics

- **Components:** 2 new + 11 existing = 13 total
- **Hooks:** 4 new custom hooks
- **Database Tables:** 4 new + 8 existing = 12 total
- **IPC Channels:** 12 new + existing = 25+ total
- **TypeScript Interfaces:** 5 new types
- **CSS Lines:** 950+ lines of styling
- **Code Lines:** 2500+ lines total

---

**Architecture Version:** 1.0.0  
**Last Updated:** 2024  
**Status:** Production Ready ✅
