import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  currency: text('currency').notNull().default('USD'),
  initialBalance: real('initial_balance').notNull().default(0),
  createdAt: text('created_at').notNull()
});

export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  toAccountId: text('to_account_id'),
  categoryId: text('category_id'),
  type: text('type').notNull(),
  amount: real('amount').notNull(),
  date: text('date').notNull(),
  merchant: text('merchant'),
  notes: text('notes'),
  createdAt: text('created_at').notNull()
});

export const bills = sqliteTable('bills', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  amount: real('amount').notNull(),
  nextDueDate: text('next_due_date').notNull(),
  recurrence: text('recurrence'),
  isPaid: integer('is_paid').notNull().default(0),
  autoPay: integer('auto_pay').notNull().default(0)
});

