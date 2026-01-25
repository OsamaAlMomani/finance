# TESTING CHECKLIST FOR P0

## Pre-Testing Setup

- [ ] Navigated to project directory
- [ ] Ran `npm install` successfully
- [ ] Ran `npm run build` successfully (no TypeScript errors)
- [ ] Started `npm run dev:react` in Terminal 1
- [ ] Started `npm run dev:electron` in Terminal 2
- [ ] Electron window opened showing the app

---

## Navigation & Layout (2 minutes)

- [ ] App loads without errors
- [ ] Sidebar is visible on left
- [ ] Sidebar shows Finance logo + menu items
- [ ] Topbar visible at top with search box + quick add button
- [ ] Main content area takes up most of the screen
- [ ] Click each sidebar item:
  - [ ] Overview — KPI page loads
  - [ ] Transactions — Table view loads
  - [ ] Calendar — Placeholder page loads
  - [ ] Forecast — Placeholder page loads
  - [ ] Risk — Placeholder page loads
  - [ ] Budgets — Placeholder page loads
  - [ ] Tax — Placeholder page loads
  - [ ] Settings — Placeholder page loads

---

## Overview Page (2 minutes)

- [ ] Page displays title "Overview"
- [ ] Shows 4–6 KPI cards:
  - [ ] **Current Balance** card (shows a number)
  - [ ] **This Month** card (shows Income/Expense/Net breakdown)
  - [ ] **Runway** card (shows X months + Safe/Warning/Critical status)
  - [ ] **Top Category** card (shows category name or "No expenses")
- [ ] Shows **Quick Actions** section with 3 buttons:
  - [ ] Add Income (button exists and clickable)
  - [ ] Add Expense (button exists and clickable)
  - [ ] Add Plan Item (button exists and clickable)
- [ ] Shows **Recent Transactions** section:
  - [ ] If empty: "No transactions yet" message
  - [ ] If populated: Shows last 10 transactions with date, description, amount

---

## Quick Add Modal (3 minutes)

### Opening Modal
- [ ] Click sidebar "Quick Add" button → modal opens
- [ ] Click topbar "+" button → modal opens
- [ ] Click "Add Income" button on Overview → modal opens
- [ ] Click "Add Expense" button on Overview → modal opens

### Modal Form
- [ ] Modal has title "Quick Add"
- [ ] Modal has close button (X) → closes modal
- [ ] Modal has two buttons: "+ Income" and "− Expense"
- [ ] Buttons toggle correctly
- [ ] Modal shows fields:
  - [ ] Date picker (defaults to today)
  - [ ] Description field (text input)
  - [ ] Amount field (number input)
  - [ ] Category selector (shows common categories)
  - [ ] Custom category input

### Adding a Transaction
- [ ] Select "Expense" type
- [ ] Enter date: 2024-01-15
- [ ] Enter description: "Test Transaction"
- [ ] Enter amount: 25.50
- [ ] Select category: "Food"
- [ ] Click "Add Transaction"
- [ ] Modal closes ✅
- [ ] Transaction appears in Transactions page ✅
- [ ] Transaction amount shows in Overview calculations ✅

### Form Validation
- [ ] Try submitting with empty description → shows error
- [ ] Try submitting with empty amount → shows error
- [ ] Error clears when fields are filled

---

## Transactions Page (4 minutes)

### Initial Load
- [ ] Page title "Transactions" visible
- [ ] Filter bar visible with buttons:
  - [ ] "Filters" button
  - [ ] "This Week" preset
  - [ ] "This Month" preset
  - [ ] "Last 3 Months" preset
- [ ] Transaction list visible (table or empty state)

### Adding via Quick Add
- [ ] Use Quick Add to add 3 transactions:
  1. Income: Salary, 1000, 2024-01-01, Salary
  2. Expense: Groceries, 50, 2024-01-05, Food
  3. Expense: Gas, 30, 2024-01-10, Transport
- [ ] All 3 appear in the table
- [ ] Income shows green + prefix
- [ ] Expenses show red − prefix

### Table Display
- [ ] Table has columns: Date, Description, Category, Amount, Actions
- [ ] Rows show correct data
- [ ] Each row has Edit (pencil icon) and Delete (trash icon) buttons
- [ ] Rows hover with light blue background

### Date Presets
- [ ] Click "This Week" → shows only this week's transactions
- [ ] Click "This Month" → shows only this month's transactions
- [ ] Click "Last 3 Months" → shows last 3 months
- [ ] Clear button appears when date range active
- [ ] Click "Clear Dates" → resets to all transactions

### Filters (Expanded)
- [ ] Click "Filters" button → filters section expands
- [ ] Shows fields: Search, Category, Type, Start Date, End Date
- [ ] Enter search text "Salary" → only that transaction shows
- [ ] Select Category "Food" → only Food category shows
- [ ] Select Type "income" → only income transactions show
- [ ] Set date range 2024-01-01 to 2024-01-08 → only transactions in range show
- [ ] Multiple filters work together (e.g., Food expenses in Jan)
- [ ] Click "Done" → filters collapse

### Edit Transaction
- [ ] Click Edit button on a transaction
- [ ] Row becomes editable with input fields
- [ ] Change description: "Groceries" → "Whole Foods"
- [ ] Change amount: 50 → 60
- [ ] Click Save → updates live in table
- [ ] Click Cancel → reverts changes

### Delete Transaction
- [ ] Click Delete button
- [ ] Confirmation prompt appears (browser confirm dialog)
- [ ] Click "OK" → transaction is removed
- [ ] Transaction no longer appears in list
- [ ] Amount recalculated in Overview

---

## Sidebar Responsiveness (1 minute)

### Toggle Sidebar
- [ ] Click sidebar toggle button (X icon when expanded)
- [ ] Sidebar collapses to narrow strip showing only icons
- [ ] Click toggle again (= icon)
- [ ] Sidebar expands showing labels again

### Mobile View (if testing on mobile/resized window)
- [ ] Resize browser to < 768px width
- [ ] Sidebar should move off-screen or collapse
- [ ] Transactions table should adapt to single column
- [ ] All buttons still clickable

---

## Data Persistence (2 minutes)

### Close and Reopen
- [ ] Add 5 transactions
- [ ] Close Electron app completely
- [ ] Reopen it (npm run dev:electron)
- [ ] Navigate to Transactions page
- [ ] All 5 transactions still there ✅ (SQLite persistence works)

### Overview Reflects Changes
- [ ] Add a transaction
- [ ] Go to Overview
- [ ] Current Balance updated
- [ ] This Month income/expense updated
- [ ] Runway recalculated
- [ ] Recent transactions list updated
- [ ] Go back to Transactions
- [ ] Transaction visible in list

---

## Error Handling (1 minute)

- [ ] Try adding transaction with invalid category → still works (uses input as-is)
- [ ] Edit then cancel → no changes saved
- [ ] Delete then refresh page → transaction gone
- [ ] Search for non-existent text → empty result
- [ ] Date filter with no matches → shows "No transactions found"

---

## Performance (30 seconds)

- [ ] Add 10 transactions → no lag
- [ ] Filter with date range → instant
- [ ] Edit transaction → saves immediately
- [ ] Navigation between pages → smooth
- [ ] Quick Add opens/closes smoothly

---

## Visual Polish (1 minute)

- [ ] Dark theme looks professional (not too bright/dark)
- [ ] Cyan accent color consistent across buttons/highlights
- [ ] Text is readable (good contrast)
- [ ] Icons load and display correctly (lucide-react icons)
- [ ] Spacing is consistent (not cramped, not too spread out)
- [ ] Borders and dividers visible
- [ ] Hover effects work on buttons/links
- [ ] Modal backdrop (dark overlay) appears when modal open

---

## Summary

**Total estimated time: 15–20 minutes for full P0 testing**

### Critical Path (Minimum Testing)
- [ ] App loads
- [ ] Can add transaction (Quick Add)
- [ ] Can see transaction in Transactions page
- [ ] Can filter transactions
- [ ] Can edit transaction
- [ ] Can delete transaction
- [ ] Overview updates with changes

**If all above pass: P0 is working! ✅**

### Extended Testing (Nice to Have)
- [ ] All sidebar pages load
- [ ] Modal works from multiple entry points
- [ ] Data persists on app restart
- [ ] Mobile responsiveness
- [ ] Error messages display correctly

---

## Known Limitations (Not Bugs)

- ❌ Settings page is placeholder (not functional)
- ❌ Calendar/Forecast/Risk/Budgets/Tax are placeholders
- ❌ Quick Add doesn't fetch categories from database (uses hardcoded list)
- ❌ No account selection (assumes single account)
- ❌ No import/export feature yet

These are expected and will be built in P1+.

---

## Issues to Report

If you find anything broken:
1. Note the **exact steps** to reproduce
2. Describe the **expected behavior**
3. Describe the **actual behavior**
4. Include any **error messages** from console

Example:
- **Steps:** Click Filters → Enter search "Food" → Click Done
- **Expected:** Only Food transactions show
- **Actual:** All transactions still visible
- **Error:** "Cannot read property 'category' of undefined"

---

**Ready? Start testing and let me know if anything breaks!** 🧪🚀
