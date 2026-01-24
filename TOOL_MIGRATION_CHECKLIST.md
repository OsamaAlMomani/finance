# Tool Migration Checklist

## Status: 1/11 Tools Complete ✅

Use this checklist to track progress updating each tool to use the database.

---

## ✅ COMPLETED

### 1. CashFlowTimeline ✅
- [x] Import useTransactions hook
- [x] Import aggregateTransactionsByMonth
- [x] Remove mock data
- [x] Add useEffect for data sync
- [x] Add loading/error states
- [x] Implement add entry with database
- [x] Test data persistence
- [x] Build verification

---

## 📋 TODO (Ready to Update)

### 2. NetWorthOverTime
**Complexity:** Easy | **Hook:** useNetWorth()

**Checklist:**
- [ ] Open: `src/ui/components/tools/NetWorthOverTime.tsx`
- [ ] Import hook: `useNetWorth` from `../../hooks/useFinanceData`
- [ ] Remove mock data state
- [ ] Add hook: `const { netWorthEntries, loading, error, addNetWorthEntry } = useNetWorth()`
- [ ] Add useEffect to transform data for chart
- [ ] Add loading/error UI
- [ ] Implement form with addNetWorthEntry
- [ ] Test: npm run build
- [ ] Test: Add entries and verify persistence

**Key Code:**
```tsx
const [data, setData] = useState([])
useEffect(() => {
  const chartData = netWorthEntries.map(entry => ({
    date: new Date(entry.date).toLocaleDateString(),
    netWorth: entry.assets - entry.liabilities
  }))
  setData(chartData)
}, [netWorthEntries])
```

---

### 3. ExpenseBreakdown
**Complexity:** Medium | **Hook:** useExpenses() + getCategoryBreakdown()

**Checklist:**
- [ ] Open: `src/ui/components/tools/ExpenseBreakdown.tsx`
- [ ] Import hook: `useExpenses` from `../../hooks/useFinanceData`
- [ ] Import: `getCategoryBreakdown` from `../../../utils/dataAggregation`
- [ ] Remove mock data
- [ ] Add hook
- [ ] Add useEffect with getCategoryBreakdown()
- [ ] Update chart to use breakdown data
- [ ] Implement add expense form
- [ ] Test: Build and verify

---

### 4. CumulativeSavings
**Complexity:** Easy | **Hook:** useTransactions() + calculateCumulativeSavings()

**Checklist:**
- [ ] Open: `src/ui/components/tools/CumulativeSavings.tsx`
- [ ] Import hook: `useTransactions`
- [ ] Import: `calculateCumulativeSavings` from utils
- [ ] Remove mock data
- [ ] Add useEffect for calculation
- [ ] Update area chart
- [ ] Test: Verify cumulative grows with new transactions

---

### 5. IncomeSourceDistribution
**Complexity:** Easy | **Hook:** useIncomeSources() + getIncomeDistribution()

**Checklist:**
- [ ] Open: `src/ui/components/tools/IncomeSourceDistribution.tsx`
- [ ] Import hook: `useIncomeSources`
- [ ] Import: `getIncomeDistribution` from utils
- [ ] Remove mock data
- [ ] Add hook and useEffect
- [ ] Update pie chart
- [ ] Implement add income form
- [ ] Test: Build and add income sources

---

### 6. BurnRateRunway
**Complexity:** Medium | **Hook:** useExpenses() + calculateBurnRate()

**Checklist:**
- [ ] Open: `src/ui/components/tools/BurnRateRunway.tsx`
- [ ] Import hook: `useExpenses`
- [ ] Import: `calculateBurnRate` from utils
- [ ] Remove mock calculations
- [ ] Add useEffect for burn rate calculation
- [ ] Update stat cards with real data
- [ ] Add 30-day trend chart
- [ ] Test: Verify calculations with known data

---

### 7. ForecastVsActual
**Complexity:** Medium | **Hook:** useForecasts()

**Checklist:**
- [ ] Open: `src/ui/components/tools/ForecastVsActual.tsx`
- [ ] Import hook: `useForecasts`
- [ ] Remove mock data
- [ ] Add hook
- [ ] Add useEffect to transform for chart
- [ ] Update bar chart with forecast vs actual
- [ ] Implement add forecast form
- [ ] Test: Add forecasts and verify display

---

### 8. CostOfLiving
**Complexity:** Easy | **Hook:** useExpenses() (aggregate)

**Checklist:**
- [ ] Open: `src/ui/components/tools/CostOfLiving.tsx`
- [ ] Import hook: `useExpenses`
- [ ] Import: `aggregateTransactionsByMonth` (or custom)
- [ ] Remove mock data
- [ ] Add hook and useEffect
- [ ] Calculate monthly costs
- [ ] Update trending chart
- [ ] Test: Verify monthly aggregations

---

### 9. CalendarPlanning
**Complexity:** Medium | **Hook:** useCalendarEvents()

**Checklist:**
- [ ] Open: `src/ui/components/tools/CalendarPlanning.tsx`
- [ ] Import hook: `useCalendarEvents`
- [ ] Remove mock events
- [ ] Add hook: `const { calendarEvents, addCalendarEvent, deleteCalendarEvent } = useCalendarEvents()`
- [ ] Implement date picker for form
- [ ] Implement add event handler
- [ ] Implement delete event handler
- [ ] Display events in calendar view
- [ ] Test: Add/edit/delete events

---

### 10. ScenarioPlanner
**Complexity:** Hard | **Hook:** useForecasts() (for scenarios)

**Checklist:**
- [ ] Open: `src/ui/components/tools/ScenarioPlanner.tsx`
- [ ] Import hook: `useForecasts`
- [ ] Design storage for Plan A/B/C scenarios
- [ ] Create separate forecast entries per scenario
- [ ] Add comparison logic
- [ ] Implement scenario selector
- [ ] Update charts to show all 3 plans
- [ ] Test: Create and compare scenarios

---

### 11. DangerSafetyMeter
**Complexity:** Hard | **Hooks:** useNetWorth() + useExpenses()

**Checklist:**
- [ ] Open: `src/ui/components/tools/DangerSafetyMeter.tsx`
- [ ] Import hooks: `useNetWorth`, `useExpenses`, `useIncomeSources`
- [ ] Remove mock calculations
- [ ] Calculate financial health metrics
- [ ] Add multiple data sources
- [ ] Implement warning indicators
- [ ] Create gauge visualization
- [ ] Test: Verify warning levels

---

## 🎯 Progress Tracking

```
Completed:  ████░░░░░░░░░░░░░░░░░░░░░ 1/11 (9%)
Easy:       ████░░░░░░░░░░░░░░░░░░░░░ 1/5  (20%)
Medium:     ░░░░░░░░░░░░░░░░░░░░░░░░░ 0/5  (0%)
Hard:       ░░░░░░░░░░░░░░░░░░░░░░░░░ 0/1  (0%)
```

---

## 📝 How to Update a Tool

1. **Open the tool file:** `src/ui/components/tools/[ToolName].tsx`

2. **Add imports:**
   ```tsx
   import { useTransactions } from '../../hooks/useFinanceData'
   import { aggregateTransactionsByMonth } from '../../../utils/dataAggregation'
   ```

3. **Replace state with hook:**
   ```tsx
   // BEFORE:
   const [data, setData] = useState([...mock data...])
   
   // AFTER:
   const { transactions, loading, error, addTransaction } = useTransactions()
   const [data, setData] = useState([])
   ```

4. **Add data sync:**
   ```tsx
   useEffect(() => {
     const transformed = aggregateTransactionsByMonth(transactions)
     setData(transformed)
   }, [transactions])
   ```

5. **Add error handling:**
   ```tsx
   if (loading) return <div>Loading...</div>
   if (error) return <div>Error: {error}</div>
   ```

6. **Test:**
   ```bash
   npm run build
   ```

7. **Mark complete** in this checklist

---

## ⏱️ Estimated Time

- Easy tools: ~5 minutes each
- Medium tools: ~15 minutes each
- Hard tools: ~30 minutes each

**Total for all tools: ~2 hours**

---

## 🎓 Learning Order

**Recommended order (easiest to hardest):**
1. NetWorthOverTime (Easy - simple hook usage)
2. ExpenseBreakdown (Easy - add aggregation)
3. CumulativeSavings (Easy - more calculations)
4. IncomeSourceDistribution (Easy - repeat pattern)
5. ForecastVsActual (Medium - forecasts)
6. BurnRateRunway (Medium - advanced calculation)
7. CostOfLiving (Easy - repeat pattern)
8. CalendarPlanning (Medium - CRUD operations)
9. ScenarioPlanner (Hard - multiple scenarios)
10. DangerSafetyMeter (Hard - multiple hooks)

---

## 🔧 Troubleshooting

**Build fails with TypeScript errors:**
- Check imports are correct relative paths
- Verify hook names match `useFinanceData.ts`
- Use `npm run build` to see full error

**Data not showing:**
- Verify useEffect dependency array includes data source
- Check console for errors
- Verify loading state is false before rendering

**Data not persisting:**
- Database file should be at `%APPDATA%/finance-app.db`
- Check Electron console for database errors
- Verify IPC handlers are registered in main.js

---

**Next Step:** Pick tool #2 (NetWorthOverTime) and start updating!

See `DATABASE_INTEGRATION_EXAMPLES.md` for complete code examples.
