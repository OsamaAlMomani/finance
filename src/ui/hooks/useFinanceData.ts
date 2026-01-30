import { useCallback, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

type TransactionType = 'income' | 'expense';

type AddTransactionInput = {
  type: TransactionType;
  description: string;
  amount: number;
  date: string;
  category?: string;
  accountId: string;
  recurring?: 'once' | 'weekly' | 'monthly';
};

export interface Account {
  id: string;
  name: string;
  currency?: string;
  initial_balance?: number;
  currentBalance?: number;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  date: string;
  merchant?: string;
}

export const useAccounts = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);

  const loadAccounts = useCallback(async () => {
    if (!window.electron) return;
    setLoading(true);
    try {
      const data = await window.electron.invoke('db-get-accounts');
      const normalized = (Array.isArray(data) ? data : []).map((acc: Account) => ({
        ...acc,
        currentBalance: acc.currentBalance ?? acc.initial_balance ?? 0
      }));
      setAccounts(normalized);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  return { accounts, loading, reload: loadAccounts };
};

export const useTransactions = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);

  const loadTransactions = useCallback(async () => {
    if (!window.electron) return;
    setLoading(true);
    try {
      const data = await window.electron.invoke('db-get-transactions', {});
      setTransactions(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const addTransaction = useCallback(async (input: AddTransactionInput) => {
    if (!window.electron) return;

    return window.electron.invoke('db-add-transaction', {
      id: uuidv4(),
      type: input.type,
      amount: input.amount,
      date: input.date,
      merchant: input.description,
      notes: '',
      category: input.category ?? null,
      accountId: input.accountId,
      tags: [],
      attachmentPath: null,
      taxAmount: 0
    });
  }, []);

  return { transactions, loading, addTransaction, reload: loadTransactions };
};
