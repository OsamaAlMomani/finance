# Account Balance & Transfer Fixes

## Issues Fixed

### ✅ Issue 1: Account Balances Not Updating
**Problem**: Account balances displayed only the `initial_balance` and didn't reflect transactions (income, expenses, transfers).

**Solution**:
- Created `getAccountsWithBalance()` function that calculates current balance:
  - `current_balance = initial_balance + income - expenses - transfers_out + transfers_in`
- Added new IPC handler `db-get-accounts-with-balance`
- Updated Dashboard to use this new function
- Dashboard now shows:
  - Current balance (calculated from transactions)
  - Initial balance (shown in smaller text if different from current)

### ✅ Issue 2: Transfer Transactions Not Showing From/To Accounts
**Problem**: Transfer transactions didn't have a way to specify destination account, and the UI didn't show transfer flow.

**Solution**:

#### Database Changes:
- Added `to_account_id` column to `transactions` table for destination account
- Added migration script to update existing databases automatically
- Updated transaction queries to include `to_account_name`

#### Backend Changes:
- Modified `addTransaction()` to accept `toAccountId` parameter
- Modified `updateTransaction()` to accept `toAccountId` parameter
- Updated balance calculations to handle transfers correctly

#### UI Changes (Transactions Page):
- Added `toAccount` field to transaction form state
- Added conditional "To Account" dropdown (appears only for transfers)
- Account dropdown label changes to "From Account" when type is "transfer"
- Destination account dropdown filters out the source account
- Transaction table now displays:
  - For transfers: "Source Account → Destination Account"
  - For income/expense: Just the account name
- Amount displays with "→" symbol for transfers (blue color)

## How It Works Now

### Adding a Transaction:
1. Select transaction type (Income/Expense/Transfer)
2. If **Transfer** is selected:
   - "Account" field becomes "From Account"
   - "To Account" field appears (can't select same account)
   - Category field still available for categorization
3. Save transaction with both accounts

### Viewing Transactions:
- **Income**: Green `+$100.00` - Account Name
- **Expense**: Red `-$50.00` - Account Name
- **Transfer**: Blue `→$200.00` - Checking → Savings

### Account Balances:
- Dashboard shows calculated current balance for each account
- Balances update automatically when transactions are added/edited/deleted
- Formula: Initial + Income - Expenses - Transfers Out + Transfers In

## Testing Checklist

✅ Create transfer transaction  
✅ Verify "From Account" and "To Account" dropdowns appear  
✅ Verify can't select same account for source and destination  
✅ Save transfer and see it in transaction list  
✅ Check transfer displays as "Account A → Account B"  
✅ Verify source account balance decreased  
✅ Verify destination account balance increased  
✅ Add income transaction  
✅ Verify account balance increased  
✅ Add expense transaction  
✅ Verify account balance decreased  
✅ Edit existing transfer  
✅ Delete transaction and verify balance updates  

## Migration Support

The system automatically migrates existing databases by:
1. Checking if `to_account_id` column exists
2. If missing, adds it via `ALTER TABLE`
3. Existing transactions remain functional
4. New transfers can use the destination account feature

All changes are backward compatible - old databases will be automatically upgraded on first run!
