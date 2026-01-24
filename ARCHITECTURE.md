# Finance Tools Architecture & Business Logic

This document explains the architecture and business logic for each finance tool based on the "Finance Charts & Business Logic Guide."

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Dashboard Component                      │
│         (Navigation, tool selection, routing)               │
└──────────────────┬──────────────────────────────────────────┘
                   │
        ┌──────────┴──────────────────────────┬────────────────┐
        │                                     │                │
   ┌────▼─────┐  ┌──────────┐  ┌──────────┐ │  ┌───────────┐│
   │ Cash     │  │ Net      │  │ Expense  │ │  │ Cumulative││
   │ Flow     │  │ Worth    │  │ Breakdown│ │  │ Savings  ││
   └──────────┘  └──────────┘  └──────────┘ │  └───────────┘│
                                             │
                                    ┌────────┴────────┐
                                    │                 │
                              ┌─────▼───┐  ┌────────▼──┐
                              │ Burn    │  │ Forecast ││
                              │ Rate    │  │ vs       ││
                              └─────────┘  └──────────┘│

        ┌────────────────────────────────────────────────┐
        │        ┌──────────────┐  ┌──────────────┐    │
        │        │ Income Dist. │  │ Cost of      │    │
        │        │              │  │ Living       │    │
        │        └──────────────┘  └──────────────┘    │
        └────────────────────────────────────────────────┘
```

## Data Flow Architecture

### Three-Layer Separation (as per guide)

```
1. RAW EVENTS LAYER
   ├── Income entries (source, amount, date)
   ├── Expense entries (category, amount, date, recurring flag)
   └── Asset/Liability entries (type, amount, date)

2. DERIVED STATES LAYER
   ├── Net = Income - Expenses
   ├── Net Worth = Assets - Liabilities
   ├── Cumulative Savings = previous + current net
   ├── Burn Rate = avg(monthly_expenses)
   ├── Runway = cash / burn_rate
   └── Variance = Actual - Forecast

3. CONTEXTUAL DATA LAYER
   ├── Inflation indexes (CPI - external data)
   ├── Category standards (benchmarks)
   └── Economic indicators (read-only)
```

## Tool Specifications

### 1. Cash Flow Timeline
```
Schema: month, income_total, expense_total (negative), net (formula)

Business Rules:
- Income is POSITIVE
- Expenses are NEGATIVE
- Net = Income + Expenses (algebraic: sum)
- Sort strictly by date
- Enforce negative expenses

Use Case: Financial stability indicator
Question: Is the user cash flow positive?
```

### 2. Net Worth Over Time
```
Schema: month, assets_total, liabilities_total, net_worth

Business Rules:
- This is STATE data (not FLOW)
- Net Worth = Assets − Liabilities
- Never mix with income/expenses (separate from Cash Flow)
- Never reset without user intent

Use Case: Long-term wealth measurement
Question: Is the user's wealth increasing?
```

### 3. Expense Breakdown by Category
```
Schema: date, category, amount (negative), recurring (boolean)

Business Rules:
- Group expenses by category
- Support recurring vs one-time
- Normalize categories
- Allow uncategorized entries
- Don't enforce category limits

Use Case: Spending pattern analysis
Question: Where is money actually going?
```

### 4. Cumulative Savings Curve
```
Schema: month, net, cumulative_savings (derived)

Business Rules:
- cumulative[n] = cumulative[n-1] + net
- DERIVED DATA ONLY (not user-entered)
- NEVER reset without user intent
- Shows long-term discipline

Use Case: Progress momentum tracking
Question: Am I making consistent progress?

Formula: cumulative_savings[n] = cumulative_savings[n-1] + net
```

### 5. Burn Rate & Runway
```
Schema: current_cash, avg_monthly_burn, runway_months

Business Rules:
- Burn Rate = average(monthly_expenses)
- Runway = current_cash / burn_rate
- INTENTIONALLY IGNORE INCOME (worst-case scenario)
- Focus on expense trend only

Use Case: Survival planning
Question: How long until money runs out?

Formula: runway_months = cash / avg_monthly_expenses
```

### 6. Forecast vs Actual
```
Schema: month, forecast_income, forecast_expense, actual_income, actual_expense

Business Rules:
- Variance = Actual − Forecast
- Lock PAST months (no editing actuals)
- Allow forecast edits for FUTURE periods only
- Calculate positive/negative variance
- Show planning accuracy trend

Use Case: Forecast quality measurement
Question: How accurate is my planning?
```

### 7. Income Source Distribution
```
Schema: date, source, amount

Business Rules:
- Group income by source and sum
- NEVER MIX EXPENSES HERE
- Track diversification (# of sources)
- Prepare for tax logic expansion
- Support variable income sources

Use Case: Income stability evaluation
Question: Is my income stable/diversified?
```

### 8. Cost of Living & Inflation Context
```
Schema: month, category, index_value

Business Rules:
- External indexed data (CPI - Consumer Price Index)
- READ-ONLY reference data
- CACHE aggressively
- Compare user expenses to index
- Show inflation impact on actual costs

Use Case: Economic context for spending
Question: How much is inflation affecting my lifestyle?

Formula: Inflation Impact = (User Spending × Current Index) / Base Index
```

## Calculation Formulas

### Core Calculations

| Tool | Formula | Notes |
|------|---------|-------|
| **Cash Flow Net** | Income - Expenses | Expenses stored as negative |
| **Net Worth** | Assets - Liabilities | State data, never reset |
| **Cumulative Savings** | Prev Cumulative + Current Net | Derived, locked |
| **Burn Rate** | SUM(monthly_expenses) / 12 | Ignore income |
| **Runway** | Current Cash / Avg Monthly Burn | Months until depletion |
| **Variance** | Actual - Forecast | Shows planning accuracy |
| **Inflation Impact** | Current Cost × (Current Index / Base Index) | Shows real cost change |
| **Diversification** | COUNT(unique_income_sources) | Higher = better |

## Data Persistence Strategy

Currently all data is in component state. To add persistence:

```typescript
// Option 1: localStorage (simple)
const saveData = (key: string, data: any) => {
  localStorage.setItem(key, JSON.stringify(data))
}

const loadData = (key: string) => {
  return JSON.parse(localStorage.getItem(key) || '[]')
}

// Option 2: SQLite (production)
// Use electron-better-sqlite3 for local database
// Benefits: larger data capacity, relationships, queries

// Option 3: Cloud (scalable)
// Firebase, Supabase, or custom backend
// Benefits: sync across devices, backups, sharing
```

## Error Prevention Strategies

### Validation Rules

```typescript
// Cash Flow
✓ Expenses must be negative
✓ Dates must be in order
✓ Income must be > 0

// Net Worth
✓ Never reset cumulative data without confirmation
✓ Assets and liabilities must be positive
✓ Never allow mixing with transaction data

// Burn Rate
✓ Only look at expenses, ignore income
✓ Use 12-month average (rolling)
✓ Handle zero expenses gracefully

// Forecast vs Actual
✓ Lock past months immediately
✓ Allow edits to current + future only
✓ Calculate variance automatically
```

## Performance Considerations

### Chart Rendering
- Limit data points to last 24 months for performance
- Use Recharts ResponsiveContainer for responsive sizing
- Memoize expensive calculations

### Data Size
- Keep monthly summaries (don't store every transaction)
- Derive values from summaries (don't duplicate)
- Archive old data after 5 years

### Caching
- Cache external CPI index data (update monthly)
- Cache calculations for past months (immutable)
- Invalidate cache only when new data added

## Extensibility Points

### Add New Tools
1. Create `src/ui/components/tools/NewTool.tsx`
2. Import in Dashboard.tsx
3. Add to tools array with icon, color, component
4. Styling automatically applied

### Modify Business Logic
1. Each tool isolated in own component
2. Calculate functions are separate
3. Can replace without affecting others
4. Easy to add new fields

### Integration Points
1. Add localStorage export/import
2. Connect to real APIs (stocks, inflation)
3. Add database backend
4. Add authentication
5. Add sharing/collaboration

## Recommended Next Steps

1. **Phase 1:** Add localStorage persistence
2. **Phase 2:** Add data export (CSV/PDF)
3. **Phase 3:** Add recurring transaction automation
4. **Phase 4:** Add real API integration (stocks, crypto, inflation)
5. **Phase 5:** Add tax calculations
6. **Phase 6:** Add investment analysis tools
7. **Phase 7:** Add collaborative features
8. **Phase 8:** Add mobile app (React Native)

## References

All business logic based on:
- Finance Charts & Business Logic Guide
- Standard financial analysis practices
- Industry best practices for budgeting apps
- YNAB (You Need A Budget) methodology
- Personal Capital strategies

