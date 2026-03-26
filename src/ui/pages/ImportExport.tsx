import React, { useState, useCallback, useEffect } from 'react';
import type { ChangeEvent } from 'react';
import { Download, Upload, FileSpreadsheet, AlertCircle, CheckCircle, X } from 'lucide-react';
import { useI18n } from '../contexts/useI18n';
import { ipcClient } from '../services/ipcClient';
import { ConfirmDialog } from '../components/ConfirmDialog';

type ImportType = 'transactions' | 'loans' | 'bills';
type QuickPanel = 'schema' | 'backup' | 'import' | 'export' | 'template';

interface ImportResult {
  success: number;
  updated: number;
  failed: number;
  errors: string[];
}

type PreviewStatus = 'add' | 'update' | 'error';

interface PreviewRow {
  rowNum: number;
  status: PreviewStatus;
  data: Record<string, string>;
  changes: string[];
  errors: string[];
}

interface PreviewSummary {
  added: number;
  updated: number;
  removed: number;
  errors: number;
}

interface SchemaStatus {
  schemaVersion: number;
  targetVersion: number;
  requiresUpgrade: boolean;
  backupCompletedAt: string | null;
}

type ConfirmAction = 'export-reset' | 'import-replace' | 'complete-v2-upgrade';

interface ImportReferenceData {
  accounts: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
  existingTransactions: Array<Record<string, unknown>>;
  existingLoans: Array<Record<string, unknown>>;
  existingBills: Array<Record<string, unknown>>;
}

interface TransactionImportPayload extends Record<string, unknown> {
  id: string;
  date: string;
  merchant: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  category?: string;
  accountId: string;
  toAccountId: string | null;
  notes: string;
}

interface LoanImportPayload extends Record<string, unknown> {
  id: string;
  name: string;
  lender: string;
  principal_amount: number;
  current_balance: number;
  interest_rate: number;
  payment_amount: number;
  payment_frequency: string;
  start_date: string;
  end_date: string | null;
  notes: string;
}

interface BillImportPayload extends Record<string, unknown> {
  id: string;
  name: string;
  amount: number;
  next_due_date: string;
  recurrence: string;
  is_paid: number;
  auto_pay: number;
}

type NormalizedImportRow =
  | { id: string; kind: 'transactions'; payload: TransactionImportPayload }
  | { id: string; kind: 'loans'; payload: LoanImportPayload }
  | { id: string; kind: 'bills'; payload: BillImportPayload };

const REQUIRED_HEADERS: Record<ImportType, string[]> = {
  transactions: ['id', 'date', 'merchant', 'amount', 'type', 'account'],
  loans: [
    'id',
    'name',
    'lender',
    'principal_amount',
    'current_balance',
    'interest_rate',
    'payment_amount',
    'payment_frequency',
    'start_date'
  ],
  bills: ['id', 'name', 'amount', 'next_due_date', 'recurrence', 'is_paid', 'auto_pay']
};

const TRANSACTION_TYPES: Array<TransactionImportPayload['type']> = ['income', 'expense', 'transfer'];

const loadXLSX = async () => import('xlsx');

const loadMammoth = async () => {
  const mammothModule = await import('mammoth');
  return (mammothModule.default ?? mammothModule) as typeof import('mammoth');
};

const loadJSZip = async () => {
  const zipModule = await import('jszip');
  return zipModule.default;
};

const parseCSV = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (next === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ',') {
      row.push(current.trim());
      current = '';
      continue;
    }

    if (char === '\n') {
      row.push(current.trim());
      if (row.some((cell) => cell.trim() !== '')) {
        rows.push(row);
      }
      row = [];
      current = '';
      continue;
    }

    if (char !== '\r') {
      current += char;
    }
  }

  row.push(current.trim());
  if (row.some((cell) => cell.trim() !== '')) {
    rows.push(row);
  }

  return rows;
};

const escapeCsvCell = (value: unknown): string => {
  const text = String(value ?? '');
  const escaped = text.replace(/"/g, '""');
  return /[",\r\n]/.test(text) ? `"${escaped}"` : escaped;
};

const toCsv = (rows: Array<Array<unknown>>): string => rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n');

const columnLetter = (index: number): string => {
  let result = '';
  let num = index + 1;
  while (num > 0) {
    const rem = (num - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    num = Math.floor((num - 1) / 26);
  }
  return result;
};

const readFileToRows = async (file: File): Promise<string[][]> => {
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension === 'csv') {
    const text = await file.text();
    return parseCSV(text);
  }

  if (extension === 'xlsx' || extension === 'xls') {
    const XLSX = await loadXLSX();
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false }) as (string | number | boolean | null)[][];
    return data
      .filter(row => row.some(cell => String(cell ?? '').trim() !== ''))
      .map(row => row.map(cell => String(cell ?? '').trim()));
  }

  if (extension === 'docx') {
    const mammoth = await loadMammoth();
    const buffer = await file.arrayBuffer();
    const htmlResult = await mammoth.convertToHtml({ arrayBuffer: buffer });
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlResult.value, 'text/html');
    const table = doc.querySelector('table');

    if (table) {
      const rows = Array.from(table.querySelectorAll('tr')).map(tr =>
        Array.from(tr.querySelectorAll('th, td')).map(cell => cell.textContent?.trim() || '')
      );
      return rows.filter(row => row.some(cell => cell.trim() !== ''));
    }

    const textResult = await mammoth.extractRawText({ arrayBuffer: buffer });
    return parseCSV(textResult.value);
  }

  throw new Error('UNSUPPORTED_FILE_FORMAT');
};

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
};

const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

const isValidIsoDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [yearRaw, monthRaw, dayRaw] = value.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

export const ImportExportPage: React.FC = () => {
  const { t } = useI18n();
  const [importType, setImportType] = useState<ImportType>('transactions');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [zipBusy, setZipBusy] = useState(false);
  const [zipMessage, setZipMessage] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [previewSummary, setPreviewSummary] = useState<PreviewSummary>({ added: 0, updated: 0, removed: 0, errors: 0 });
  const [pendingHeaders, setPendingHeaders] = useState<string[]>([]);
  const [pendingRows, setPendingRows] = useState<string[][]>([]);
  const [pendingFileName, setPendingFileName] = useState<string>('');
  const [schemaStatus, setSchemaStatus] = useState<SchemaStatus | null>(null);
  const [fullFeatureView, setFullFeatureView] = useState(false);
  const [activePanel, setActivePanel] = useState<QuickPanel>('import');
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    action: ConfirmAction | null;
    payload?: File | string;
  }>({
    open: false,
    action: null
  });

  const loadSchemaStatus = useCallback(async () => {
    try {
      const status = await ipcClient.importExport.getSchemaStatus();
      setSchemaStatus((status as SchemaStatus) || null);
    } catch {
      setSchemaStatus(null);
    }
  }, []);

  useEffect(() => {
    loadSchemaStatus();
  }, [loadSchemaStatus]);

  const generateTransactionTemplate = () => {
    const template = [
      ['id', 'date', 'merchant', 'amount', 'type', 'category', 'account', 'to_account', 'notes'],
      ['txn_20260204_001', '2026-02-04', 'Example Store', '50.00', 'expense', 'Food & Dining', 'Main Checking', '', 'Optional notes'],
      ['txn_20260203_001', '2026-02-03', 'Salary Deposit', '2000.00', 'income', 'Salary', 'Main Checking', '', ''],
      ['txn_20260202_001', '2026-02-02', 'Transfer', '100.00', 'transfer', '', 'Main Checking', 'Savings', 'Moving to savings']
    ];
    return template;
  };

  const generateLoanTemplate = () => {
    const template = [
      ['id', 'name', 'lender', 'principal_amount', 'current_balance', 'interest_rate', 'payment_amount', 'payment_frequency', 'start_date', 'end_date', 'notes'],
      ['loan_20260204_001', 'Student Loan', 'Bank of America', '50000.00', '45000.00', '5.5', '500.00', 'monthly', '2020-01-01', '2030-01-01', 'Federal student loan'],
      ['loan_20260204_002', 'Car Loan', 'Chase Auto', '25000.00', '18000.00', '4.2', '450.00', 'monthly', '2023-06-01', '2028-06-01', '']
    ];
    return template;
  };

  const generateBillTemplate = () => {
    const template = [
      ['id', 'name', 'amount', 'next_due_date', 'recurrence', 'is_paid', 'auto_pay'],
      ['bill_20260215_001', 'Electric Bill', '120.00', '2026-02-15', 'monthly', 'false', 'true'],
      ['bill_20260210_001', 'Internet', '60.00', '2026-02-10', 'monthly', 'false', 'true'],
      ['bill_20260301_001', 'Rent', '1500.00', '2026-03-01', 'monthly', 'false', 'false']
    ];
    return template;
  };

  const downloadTemplate = useCallback((type: ImportType) => {
    let template: string[][];
    let filename: string;

    switch (type) {
      case 'transactions':
        template = generateTransactionTemplate();
        filename = 'transaction_template.csv';
        break;
      case 'loans':
        template = generateLoanTemplate();
        filename = 'loan_template.csv';
        break;
      case 'bills':
        template = generateBillTemplate();
        filename = 'bill_template.csv';
        break;
    }

    const csv = toCsv(template);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const loadImportReferenceData = useCallback(async (): Promise<ImportReferenceData> => {
    const [accountsRaw, categoriesRaw, existingTransactionsRaw, existingLoansRaw, existingBillsRaw] = await Promise.all([
      ipcClient.importExport.getAccounts(),
      ipcClient.importExport.getCategories(),
      ipcClient.importExport.getTransactions({}),
      ipcClient.importExport.getLoans(),
      ipcClient.importExport.getBills()
    ]);

    return {
      accounts: Array.isArray(accountsRaw) ? accountsRaw as Array<{ id: string; name: string }> : [],
      categories: Array.isArray(categoriesRaw) ? categoriesRaw as Array<{ id: string; name: string }> : [],
      existingTransactions: Array.isArray(existingTransactionsRaw) ? existingTransactionsRaw as Array<Record<string, unknown>> : [],
      existingLoans: Array.isArray(existingLoansRaw) ? existingLoansRaw as Array<Record<string, unknown>> : [],
      existingBills: Array.isArray(existingBillsRaw) ? existingBillsRaw as Array<Record<string, unknown>> : []
    };
  }, []);

  const parseNumericField = useCallback((rawValue: string, field: string): number => {
    const value = (rawValue ?? '').trim();
    const parsed = Number.parseFloat(value);
    if (!value || !Number.isFinite(parsed)) {
      throw new Error(t('import.errors.invalidNumber', { field }));
    }
    return parsed;
  }, [t]);

  const parseBooleanField = useCallback((rawValue: string, field: string): number => {
    const normalized = (rawValue ?? '').trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized)) return 1;
    if (['false', '0', 'no', 'n', ''].includes(normalized)) return 0;
    throw new Error(t('import.errors.invalidValue', { field, value: rawValue ?? '' }));
  }, [t]);

  const parseRequiredDate = useCallback((rawValue: string, field: string): string => {
    const value = (rawValue ?? '').trim();
    if (!value || !isValidIsoDate(value)) {
      throw new Error(t('import.errors.invalidDate', { field }));
    }
    return value;
  }, [t]);

  const normalizeImportRow = useCallback((
    data: Record<string, string>,
    referenceData: Pick<ImportReferenceData, 'accounts' | 'categories'>
  ): NormalizedImportRow => {
    const id = (data.id ?? '').trim();
    if (!id) {
      throw new Error(t('import.errors.idRequired'));
    }

    if (importType === 'transactions') {
      const typeRaw = (data.type ?? '').trim().toLowerCase();
      const type = typeRaw as TransactionImportPayload['type'];
      if (!TRANSACTION_TYPES.includes(type)) {
        throw new Error(t('import.errors.invalidValue', { field: 'type', value: data.type ?? '' }));
      }

      const accountName = (data.account ?? '').trim();
      const account = referenceData.accounts.find(
        (entry) => entry.name.toLowerCase() === accountName.toLowerCase()
      );
      if (!account) {
        throw new Error(t('import.errors.accountNotFound', { name: accountName || data.account || '' }));
      }

      let categoryId: string | undefined;
      let toAccountId: string | null = null;

      if (type === 'transfer') {
        const toAccountName = (data.to_account ?? '').trim();
        if (!toAccountName) {
          throw new Error(t('import.errors.toAccountRequired'));
        }
        const toAccount = referenceData.accounts.find(
          (entry) => entry.name.toLowerCase() === toAccountName.toLowerCase()
        );
        if (!toAccount) {
          throw new Error(t('import.errors.toAccountNotFound', { name: toAccountName }));
        }
        if (toAccount.id === account.id) {
          throw new Error(t('import.errors.transferAccountMismatch'));
        }
        toAccountId = toAccount.id;
      } else {
        const categoryName = (data.category ?? '').trim();
        if (!categoryName) {
          throw new Error(t('import.errors.categoryRequired'));
        }
        const category = referenceData.categories.find(
          (entry) => entry.name.toLowerCase() === categoryName.toLowerCase()
        );
        if (!category) {
          throw new Error(t('import.errors.categoryNotFound', { name: categoryName }));
        }
        categoryId = category.id;
      }

      return {
        id,
        kind: 'transactions',
        payload: {
          id,
          date: parseRequiredDate(data.date, 'date'),
          merchant: (data.merchant ?? '').trim(),
          amount: parseNumericField(data.amount, 'amount'),
          type,
          category: categoryId,
          accountId: account.id,
          toAccountId,
          notes: (data.notes ?? '').trim()
        }
      };
    }

    if (importType === 'loans') {
      const endDateRaw = (data.end_date ?? '').trim();
      const paymentFrequency = (data.payment_frequency ?? '').trim();
      if (!paymentFrequency) {
        throw new Error(t('import.errors.invalidValue', { field: 'payment_frequency', value: '' }));
      }
      if (endDateRaw && !isValidIsoDate(endDateRaw)) {
        throw new Error(t('import.errors.invalidDate', { field: 'end_date' }));
      }

      return {
        id,
        kind: 'loans',
        payload: {
          id,
          name: (data.name ?? '').trim(),
          lender: (data.lender ?? '').trim(),
          principal_amount: parseNumericField(data.principal_amount, 'principal_amount'),
          current_balance: parseNumericField(data.current_balance, 'current_balance'),
          interest_rate: parseNumericField(data.interest_rate, 'interest_rate'),
          payment_amount: parseNumericField(data.payment_amount, 'payment_amount'),
          payment_frequency: paymentFrequency,
          start_date: parseRequiredDate(data.start_date, 'start_date'),
          end_date: endDateRaw || null,
          notes: (data.notes ?? '').trim()
        }
      };
    }

    const recurrence = (data.recurrence ?? '').trim();
    if (!recurrence) {
      throw new Error(t('import.errors.invalidValue', { field: 'recurrence', value: '' }));
    }

    return {
      id,
      kind: 'bills',
      payload: {
        id,
        name: (data.name ?? '').trim(),
        amount: parseNumericField(data.amount, 'amount'),
        next_due_date: parseRequiredDate(data.next_due_date, 'next_due_date'),
        recurrence,
        is_paid: parseBooleanField(data.is_paid, 'is_paid'),
        auto_pay: parseBooleanField(data.auto_pay, 'auto_pay')
      }
    };
  }, [importType, parseBooleanField, parseNumericField, parseRequiredDate, t]);

  const buildPreview = useCallback(async (headers: string[], dataRows: string[][]) => {
    const { accounts, categories, existingTransactions, existingLoans, existingBills } = await loadImportReferenceData();

    const existingMap = new Map<string, Record<string, unknown>>();
    const items = importType === 'transactions'
      ? existingTransactions
      : importType === 'loans'
      ? existingLoans
      : existingBills;
    (items as Record<string, unknown>[]).forEach(item => {
      if (item.id) {
        existingMap.set(String(item.id), item);
      }
    });

    const idIndex = headers.indexOf('id');
    const idCounts = new Map<string, number>();
    for (const row of dataRows) {
      const id = idIndex >= 0 ? String(row[idIndex] ?? '').trim() : '';
      if (!id) continue;
      idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
    }

    const preview: PreviewRow[] = [];
    let added = 0;
    let updated = 0;
    let errorsCount = 0;

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNum = i + 2;
      const data: Record<string, string> = {};
      headers.forEach((header, idx) => {
        data[header] = String(row[idx] ?? '').trim();
      });

      const errors: string[] = [];
      const changes: string[] = [];
      const id = (data.id ?? '').trim();
      if (id && (idCounts.get(id) ?? 0) > 1) {
        errors.push(t('import.errors.duplicateId', { id }));
      }

      try {
        normalizeImportRow(data, { accounts, categories });
      } catch (error) {
        errors.push(error instanceof Error ? error.message : t('import.errors.unknown'));
      }

      const existing = id ? existingMap.get(id) : undefined;

      if (existing) {
        headers.forEach((header, idx) => {
          const existingValue = (() => {
            if (importType === 'transactions') {
              if (header === 'category') return String(existing.category_name ?? '');
              if (header === 'account') return String(existing.account_name ?? '');
              if (header === 'to_account') return String(existing.to_account_name ?? '');
            }
            return String(existing[header] ?? '');
          })();
          const newValue = data[header] ?? '';
          if (newValue && newValue !== existingValue) {
            changes.push(`${columnLetter(idx)}${rowNum}: ${existingValue || '∅'} → ${newValue}`);
          }
        });
      }

      const status: PreviewStatus = errors.length > 0 ? 'error' : existing ? 'update' : 'add';

      if (status === 'add') added++;
      if (status === 'update') updated++;
      if (status === 'error') errorsCount++;

      preview.push({ rowNum, status, data, changes, errors });
    }

    setPreviewRows(preview);
    setPreviewSummary({ added, updated, removed: 0, errors: errorsCount });
  }, [importType, loadImportReferenceData, normalizeImportRow, t]);

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setResult(null);
    setPreviewOpen(false);

    try {
      const rows = await readFileToRows(file);

      if (rows.length < 2) {
        throw new Error(t('import.errors.fileTooShort'));
      }

      const headers = rows[0]
        .map((header) => String(header ?? '').trim().toLowerCase());
      const dataRows = rows.slice(1).map((row) => row.map((cell) => String(cell ?? '').trim()));

      const missingHeaders = REQUIRED_HEADERS[importType].filter((requiredHeader) => !headers.includes(requiredHeader));
      if (missingHeaders.length > 0) {
        throw new Error(t('import.errors.missingColumns', { columns: missingHeaders.join(', ') }));
      }

      setPendingHeaders(headers);
      setPendingRows(dataRows);
      setPendingFileName(file.name);
      setPreviewHeaders(headers);

      await buildPreview(headers, dataRows);
      setPreviewOpen(true);
    } catch (error) {
      setResult({
        success: 0,
        updated: 0,
        failed: 0,
        errors: [
          error instanceof Error
            ? error.message === 'UNSUPPORTED_FILE_FORMAT'
              ? t('import.errors.unsupportedFile')
              : error.message
            : t('import.errors.unknown')
        ]
      });
    } finally {
      setImporting(false);
      event.target.value = '';
    }
  };

  const applyImport = async () => {
    if (pendingRows.length === 0 || pendingHeaders.length === 0) return;

    setImporting(true);
    setResult(null);

    try {
      const headers = pendingHeaders;
      const dataRows = pendingRows;

      const importedIds: string[] = [];

      let success = 0;
      let updated = 0;
      let failed = 0;
      const errors: string[] = [];

      const { accounts, categories, existingTransactions, existingLoans, existingBills } = await loadImportReferenceData();

      const existingMap = new Map<string, Record<string, unknown>>();
      const items = importType === 'transactions'
        ? existingTransactions
        : importType === 'loans'
        ? existingLoans
        : existingBills;
      (items as Record<string, unknown>[]).forEach(item => {
        if (item.id) {
          existingMap.set(String(item.id), item);
        }
      });

      const idIndex = headers.indexOf('id');
      const idCounts = new Map<string, number>();
      for (const row of dataRows) {
        const id = idIndex >= 0 ? String(row[idIndex] ?? '').trim() : '';
        if (!id) continue;
        idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
      }

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const rowNum = i + 2;

        try {
          const data: Record<string, string> = {};
          headers.forEach((header, idx) => {
            data[header] = String(row[idx] ?? '').trim();
          });

          const duplicateId = (data.id ?? '').trim();
          if (duplicateId && (idCounts.get(duplicateId) ?? 0) > 1) {
            throw new Error(t('import.errors.duplicateId', { id: duplicateId }));
          }

          const normalizedRow = normalizeImportRow(data, { accounts, categories });
          importedIds.push(normalizedRow.id);

          const exists = existingMap.has(normalizedRow.id);
          if (normalizedRow.kind === 'transactions') {
            if (exists) {
              await ipcClient.importExport.updateTransaction(normalizedRow.payload);
              updated++;
            } else {
              await ipcClient.importExport.addTransaction(normalizedRow.payload);
              success++;
            }
          } else if (normalizedRow.kind === 'loans') {
            await ipcClient.importExport.saveLoan(normalizedRow.payload);
            if (exists) {
              updated++;
            } else {
              success++;
            }
          } else {
            await ipcClient.importExport.saveBill(normalizedRow.payload);
            if (exists) {
              updated++;
            } else {
              success++;
            }
          }
        } catch (error) {
          failed++;
          errors.push(`${t('import.preview.rowLabel', { row: rowNum })}: ${error instanceof Error ? error.message : t('import.errors.unknown')}`);
        }
      }

      setResult({ success, updated, failed, errors });
      localStorage.setItem('lastImport', JSON.stringify({
        ids: importedIds,
        success,
        updated,
        failed,
        type: importType,
        at: new Date().toISOString()
      }));
      setPreviewOpen(false);
      setPendingRows([]);
      setPendingHeaders([]);
      setPendingFileName('');
    } catch (error) {
      setResult({
        success: 0,
        updated: 0,
        failed: 0,
        errors: [error instanceof Error ? error.message : t('import.errors.unknown')]
      });
    } finally {
      setImporting(false);
    }
  };

  const exportData = useCallback(async (type: ImportType) => {
    try {
      let data: Record<string, unknown>[] = [];
      let headers: string[];
      let filename: string;

      switch (type) {
        case 'transactions': {
          const rows = await ipcClient.importExport.getTransactions({});
          data = Array.isArray(rows) ? rows as Record<string, unknown>[] : [];
          headers = ['id', 'date', 'merchant', 'amount', 'type', 'category_name', 'account_name', 'to_account_name', 'notes'];
          filename = `transactions_export_${new Date().toISOString().split('T')[0]}.csv`;
          break;
        }
        case 'loans': {
          const rows = await ipcClient.importExport.getLoans();
          data = Array.isArray(rows) ? rows as Record<string, unknown>[] : [];
          headers = ['id', 'name', 'lender', 'principal_amount', 'current_balance', 'interest_rate', 'payment_amount', 'payment_frequency', 'start_date', 'end_date', 'notes'];
          filename = `loans_export_${new Date().toISOString().split('T')[0]}.csv`;
          break;
        }
        case 'bills': {
          const rows = await ipcClient.importExport.getBills();
          data = Array.isArray(rows) ? rows as Record<string, unknown>[] : [];
          headers = ['id', 'name', 'amount', 'next_due_date', 'recurrence', 'is_paid', 'auto_pay'];
          filename = `bills_export_${new Date().toISOString().split('T')[0]}.csv`;
          break;
        }
      }

      const rows = [headers, ...data.map((item) => headers.map((h) => String(item[h] || '')))];

      const csv = toCsv(rows);
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setZipMessage(t('import.exportFailed', { error: error instanceof Error ? error.message : t('import.errors.unknown') }));
    }
  }, [t]);

  const exportAllDataZip = useCallback(async (resetAfter = false) => {
    try {
      setZipBusy(true);
      setZipMessage(null);

      const [
        accounts,
        categories,
        subcategories,
        tags,
        labels,
        classification_rules,
        transactionsRaw,
        budgets,
        goals,
        goal_contributions,
        bills,
        loans,
        loan_payments,
        metadata_entries,
        realtime_state,
        plans,
        recurring_items,
        scenarios,
        alerts,
        alert_events,
        monthly_settlements,
        settlement_events,
        monthly_reports,
        report_exports,
        permissions,
        share_snapshots,
        tax_rules,
        app_settings
      ] = await Promise.all([
        ipcClient.importExport.getAccounts(),
        ipcClient.importExport.getCategories(),
        ipcClient.importExport.getSubcategories().catch(() => []),
        ipcClient.importExport.getTags().catch(() => []),
        ipcClient.importExport.getLabels().catch(() => []),
        ipcClient.importExport.getClassificationRules().catch(() => []),
        ipcClient.importExport.getTransactions({}).catch(() => []),
        ipcClient.importExport.getBudgets(),
        ipcClient.importExport.getGoals(),
        ipcClient.importExport.getGoalContributions().catch(() => []),
        ipcClient.importExport.getBills(),
        ipcClient.importExport.getLoans(),
        ipcClient.importExport.getLoanPayments({ limit: 100000 }).catch(() => []),
        ipcClient.importExport.getMetadata({ limit: 100000 }).catch(() => []),
        ipcClient.importExport.getRealtimeState({ includeExpired: true, limit: 100000 }).catch(() => []),
        ipcClient.importExport.getPlans(),
        ipcClient.importExport.getRecurringItems().catch(() => []),
        ipcClient.importExport.getScenarios().catch(() => []),
        ipcClient.importExport.getAlerts({ includeResolved: true }).catch(() => []),
        ipcClient.importExport.getAlertEvents({}).catch(() => []),
        ipcClient.importExport.getSettlements().catch(() => []),
        ipcClient.importExport.getSettlementEvents({}).catch(() => []),
        ipcClient.importExport.getReports().catch(() => []),
        ipcClient.importExport.getReportExports({}).catch(() => []),
        ipcClient.importExport.getPermissions().catch(() => []),
        ipcClient.importExport.listShareSnapshots({}).catch(() => []),
        ipcClient.importExport.getTaxRules().catch(() => []),
        ipcClient.importExport.getAppSettings().catch(() => [])
      ]);

      const transactions = Array.isArray(transactionsRaw) ? transactionsRaw as Array<{ id: string; tags?: Array<{ id: string }>; labels?: Array<{ id: string }> }> : [];
      const transaction_tags: Array<{ transaction_id: string; tag_id: string }> = [];
      const transaction_labels: Array<{ transaction_id: string; label_id: string }> = [];
      for (const tx of transactions) {
        for (const tag of tx.tags || []) {
          if (tag?.id) transaction_tags.push({ transaction_id: tx.id, tag_id: tag.id });
        }
        for (const label of tx.labels || []) {
          if (label?.id) transaction_labels.push({ transaction_id: tx.id, label_id: label.id });
        }
      }

      const payload = {
        accounts,
        categories,
        subcategories,
        tags,
        labels,
        classification_rules,
        transactions,
        transaction_tags,
        transaction_labels,
        budgets,
        goals,
        goal_contributions,
        bills,
        loans,
        loan_payments,
        metadata_entries,
        realtime_state,
        plans,
        recurring_items,
        scenarios,
        alerts,
        alert_events,
        monthly_settlements,
        settlement_events,
        monthly_reports,
        report_exports,
        permissions,
        share_snapshots,
        tax_rules,
        app_settings
      };

      const JSZip = await loadJSZip();
      const zip = new JSZip();
      zip.file('backup.json', JSON.stringify(payload, null, 2));
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      const buffer = await blob.arrayBuffer();
      const dataBase64 = arrayBufferToBase64(buffer);
      const defaultPath = `finance_backup_${new Date().toISOString().split('T')[0]}.zip`;

      const saveResult = await ipcClient.app.saveZip({ defaultPath, dataBase64 });
      if (saveResult?.canceled) {
        setZipMessage(t('import.exportCanceled'));
        return;
      }

      await ipcClient.importExport.markV2BackupComplete({ filePath: saveResult?.filePath || defaultPath });
      await loadSchemaStatus();

      if (resetAfter) {
        await ipcClient.importExport.resetAll();
        setZipMessage(t('import.resetDone'));
      } else {
        setZipMessage(t('import.exportSuccess'));
      }
    } catch (error) {
      setZipMessage(t('import.exportFailed', { error: error instanceof Error ? error.message : t('import.errors.unknown') }));
    } finally {
      setZipBusy(false);
    }
  }, [t, loadSchemaStatus]);

  const importAllDataZip = useCallback(async (fileOrBase64: File | string) => {
    try {
      setZipBusy(true);
      setZipMessage(null);

      const buffer = typeof fileOrBase64 === 'string'
        ? base64ToArrayBuffer(fileOrBase64)
        : await fileOrBase64.arrayBuffer();
      const JSZip = await loadJSZip();
      const zip = await JSZip.loadAsync(buffer);
      const backupFile = zip.file('backup.json');
      if (!backupFile) throw new Error('backup.json not found in zip');

      const text = await backupFile.async('string');
      const payload = JSON.parse(text);

      await ipcClient.importExport.replaceAll(payload);
      setZipMessage(t('import.importSuccess'));
    } catch (error) {
      setZipMessage(t('import.importFailed', { error: error instanceof Error ? error.message : t('import.errors.unknown') }));
    } finally {
      setZipBusy(false);
    }
  }, [t]);

  const openConfirm = useCallback((action: ConfirmAction, payload?: File | string) => {
    setConfirmState({ open: true, action, payload });
  }, []);

  const closeConfirm = useCallback(() => {
    setConfirmState({ open: false, action: null });
  }, []);

  const runConfirmedAction = useCallback(async () => {
    const { action, payload } = confirmState;
    closeConfirm();

    if (action === 'export-reset') {
      await exportAllDataZip(true);
      return;
    }

    if (action === 'import-replace') {
      if (!payload) return;
      await importAllDataZip(payload);
      return;
    }

    if (action === 'complete-v2-upgrade') {
      try {
        await ipcClient.importExport.completeV2Upgrade();
        await loadSchemaStatus();
        setZipMessage(t('import.upgradeDone'));
      } catch (error) {
        setZipMessage(error instanceof Error ? error.message : t('import.upgradeFailed'));
      }
    }
  }, [closeConfirm, confirmState, exportAllDataZip, importAllDataZip, loadSchemaStatus, t]);

  const quickPanels: Array<{ id: QuickPanel; label: string; description: string }> = [
    { id: 'schema', label: 'Schema', description: 'Upgrade state and maintenance controls' },
    { id: 'backup', label: t('import.fullBackup'), description: 'Export or restore a full ZIP backup' },
    { id: 'import', label: t('import.importData'), description: 'Upload files and preview changes before apply' },
    { id: 'export', label: t('import.exportData'), description: 'Download transactions, loans, or bills CSVs' },
    { id: 'template', label: t('import.templateRef'), description: 'Field requirements for each template type' }
  ];

  const renderSchemaCard = (extraClass = '') => (
    <div className={`card ${extraClass}`.trim()}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-xl font-bold">Schema Upgrade Status</h3>
          <p className="text-sm text-gray-600">
            Version {schemaStatus?.schemaVersion ?? 1} / target {schemaStatus?.targetVersion ?? 2}
          </p>
          <p className="text-xs text-gray-500">
            Requires V2 upgrade: {schemaStatus?.requiresUpgrade ? 'yes' : 'no'} | Backup marked: {schemaStatus?.backupCompletedAt ? new Date(schemaStatus.backupCompletedAt).toLocaleString() : 'no'}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn bg-gray-100" onClick={loadSchemaStatus}>Refresh</button>
          <button
            className={`btn text-white ${schemaStatus?.requiresUpgrade ? 'bg-orange-500' : 'bg-gray-400'}`}
            disabled={!schemaStatus?.requiresUpgrade}
            onClick={() => openConfirm('complete-v2-upgrade')}
          >
            Complete V2 Upgrade
          </button>
        </div>
      </div>
    </div>
  );

  const renderBackupCard = (extraClass = '') => (
    <div className={`card zip-card ${extraClass}`.trim()}>
      <div className="flex items-center gap-2 mb-4">
        <Download className="text-indigo-500" size={24} />
        <h3 className="text-xl font-bold">{t('import.fullBackup')}</h3>
      </div>
      <p className="text-sm text-gray-600 mb-4">{t('import.fullBackupDesc')}</p>
      <div className="flex flex-wrap gap-3 zip-actions">
        <button
          onClick={() => exportAllDataZip(false)}
          className="btn bg-indigo-500 text-white"
          disabled={zipBusy}
        >
          {t('import.exportAllZip')}
        </button>
        <button
          onClick={() => openConfirm('export-reset')}
          className="btn bg-red-500 text-white"
          disabled={zipBusy}
        >
          {t('import.exportResetZip')}
        </button>
        <button
          className="btn bg-gray-100"
          disabled={zipBusy}
          onClick={async () => {
            const result = await ipcClient.app.openZip();
            if (!result || result.canceled || !result.dataBase64) return;
            openConfirm('import-replace', result.dataBase64);
          }}
        >
          {t('import.importBackupZip')}
        </button>
      </div>
      {zipMessage && (
        <p className="text-sm mt-3 text-gray-700">{zipMessage}</p>
      )}
      <p className="text-xs text-gray-500 mt-2">{t('import.backupIncludes')}</p>
    </div>
  );

  const renderImportCard = (compact = false, extraClass = '') => (
    <div className={`card ${extraClass}`.trim()}>
      <div className="flex items-center gap-2 mb-4">
        <Upload className="text-blue-500" size={24} />
        <h3 className="text-xl font-bold">{t('import.importData')}</h3>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="import-type" className="block text-sm font-bold mb-2">{t('import.dataType')}</label>
          <select
            id="import-type"
            className="w-full p-2 border rounded"
            value={importType}
            onChange={(e) => setImportType(e.target.value as ImportType)}
          >
            <option value="transactions">{t('transactions.title')}</option>
            <option value="loans">{t('loans.title')}</option>
            <option value="bills">{t('bills.title')}</option>
          </select>
        </div>

        {compact ? (
          <details className="bg-blue-50 border border-blue-200 rounded p-3">
            <summary className="text-sm text-blue-800 font-bold cursor-pointer">{t('import.instructions')}</summary>
            <ol className="text-xs text-blue-700 space-y-1 ml-4 list-decimal mt-2">
              <li>{t('import.step1')}</li>
              <li>{t('import.step2')}</li>
              <li>{t('import.step3')}</li>
              <li>{t('import.step4')}</li>
            </ol>
            <p className="text-xs text-blue-700 mt-2">
              {t('import.supported')}
            </p>
          </details>
        ) : (
          <div className="bg-blue-50 border border-blue-200 rounded p-3">
            <p className="text-sm text-blue-800 mb-2">
              <strong>{t('import.instructions')}</strong>
            </p>
            <ol className="text-xs text-blue-700 space-y-1 ml-4 list-decimal">
              <li>{t('import.step1')}</li>
              <li>{t('import.step2')}</li>
              <li>{t('import.step3')}</li>
              <li>{t('import.step4')}</li>
            </ol>
            <p className="text-xs text-blue-700 mt-2">
              {t('import.supported')}
            </p>
          </div>
        )}

        <button
          onClick={() => downloadTemplate(importType)}
          className="w-full btn bg-green-500 text-white flex items-center justify-center gap-2"
        >
          <Download size={18} />
          {t('import.downloadTemplate', { type: importType.charAt(0).toUpperCase() + importType.slice(1) })}
        </button>

        <div className="border-2 border-dashed border-gray-300 rounded p-6 text-center">
          <input
            type="file"
            accept=".csv,.xlsx,.xls,.docx"
            onChange={handleFileUpload}
            className="hidden"
            id="csv-upload"
            disabled={importing}
          />
          <label
            htmlFor="csv-upload"
            className={`cursor-pointer flex flex-col items-center gap-2 ${
              importing ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <FileSpreadsheet size={48} className="text-gray-400" />
            <span className="font-bold text-gray-600">
              {importing ? t('import.importing') : t('import.clickToUpload')}
            </span>
            <span className="text-xs text-gray-400">{t('import.supported')}</span>
          </label>
        </div>

        {result && (
          <div className={`border-2 rounded p-4 ${
            result.failed > 0 ? 'border-orange-300 bg-orange-50' : 'border-green-300 bg-green-50'
          }`}>
            <div className="flex items-start gap-2 mb-2">
              {result.failed === 0 ? (
                <CheckCircle className="text-green-600" size={20} />
              ) : (
                <AlertCircle className="text-orange-600" size={20} />
              )}
              <div className="flex-1">
                <p className="font-bold">{t('import.importResults')}</p>
                <ul className="text-sm mt-2 space-y-1">
                  {result.success > 0 && (
                    <li className="text-green-700">✓ {t('import.newRecords', { count: result.success })}</li>
                  )}
                  {result.updated > 0 && (
                    <li className="text-blue-700">↻ {t('import.updatedRecords', { count: result.updated })}</li>
                  )}
                  {result.failed > 0 && (
                    <li className="text-red-700">✗ {t('import.failedRecords', { count: result.failed })}</li>
                  )}
                </ul>
                {result.errors.length > 0 && (
                  <details className="mt-2">
                    <summary className="text-xs text-red-600 cursor-pointer">
                      {t('import.showErrors', { count: result.errors.length })}
                    </summary>
                    <ul className="text-xs text-red-600 mt-1 ml-4 max-h-40 overflow-y-auto">
                      {result.errors.map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderExportCard = (extraClass = '') => (
    <div className={`card ${extraClass}`.trim()}>
      <div className="flex items-center gap-2 mb-4">
        <Download className="text-green-500" size={24} />
        <h3 className="text-xl font-bold">{t('import.exportData')}</h3>
      </div>

      <div className="space-y-4">
        <p className="text-sm text-gray-600">{t('import.exportDesc')}</p>
        <ul className="text-sm text-gray-600 space-y-1 ml-4 list-disc">
          <li>{t('import.exportUse1')}</li>
          <li>{t('import.exportUse2')}</li>
          <li>{t('import.exportUse3')}</li>
          <li>{t('import.exportUse4')}</li>
        </ul>

        <div className="space-y-3 pt-4">
          <button
            onClick={() => exportData('transactions')}
            className="w-full btn bg-blue-500 text-white flex items-center justify-center gap-2"
          >
            <FileSpreadsheet size={18} />
            {t('import.exportAllTransactions')}
          </button>

          <button
            onClick={() => exportData('loans')}
            className="w-full btn bg-red-500 text-white flex items-center justify-center gap-2"
          >
            <FileSpreadsheet size={18} />
            {t('import.exportAllLoans')}
          </button>

          <button
            onClick={() => exportData('bills')}
            className="w-full btn bg-purple-500 text-white flex items-center justify-center gap-2"
          >
            <FileSpreadsheet size={18} />
            {t('import.exportAllBills')}
          </button>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded p-3 mt-4">
          <p className="text-xs text-gray-600">
            <strong>{t('import.exportNote')}</strong>
          </p>
        </div>
      </div>
    </div>
  );

  const renderTemplateCard = (extraClass = '') => (
    <div className={`card ${extraClass}`.trim()}>
      <h3 className="text-lg font-bold mb-3">{t('import.templateRef')}</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div>
          <p className="font-bold mb-2">{t('import.template.transactions')}</p>
          <ul className="space-y-1 text-gray-600">
            <li>• <strong>{t('import.template.idRequired')}</strong></li>
            <li>• <strong>{t('import.template.type')}</strong></li>
            <li>• <strong>{t('import.template.category')}</strong></li>
            <li>• <strong>{t('import.template.account')}</strong></li>
            <li>• <strong>{t('import.template.toAccount')}</strong></li>
          </ul>
        </div>
        <div>
          <p className="font-bold mb-2">{t('import.template.loans')}</p>
          <ul className="space-y-1 text-gray-600">
            <li>• <strong>{t('import.template.idRequired')}</strong></li>
            <li>• <strong>{t('import.template.paymentFrequency')}</strong></li>
            <li>• <strong>{t('import.template.interestRate')}</strong></li>
            <li>• <strong>{t('import.template.dates')}</strong></li>
          </ul>
        </div>
        <div>
          <p className="font-bold mb-2">{t('import.template.bills')}</p>
          <ul className="space-y-1 text-gray-600">
            <li>• <strong>{t('import.template.idRequired')}</strong></li>
            <li>• <strong>{t('import.template.recurrence')}</strong></li>
            <li>• <strong>{t('import.template.isPaid')}</strong></li>
            <li>• <strong>{t('import.template.autoPay')}</strong></li>
          </ul>
        </div>
      </div>
    </div>
  );

  return (
    <div className="import-export-page w-full max-w-6xl mx-auto px-6 py-4 pb-8 flex flex-col gap-5 overflow-y-auto">
      <h2 className="text-3xl font-bold font-heading mb-6">{t('import.title')}</h2>

      <div className="card quick-windows-card mb-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-xl font-bold">Quick Windows</h3>
            <p className="text-sm text-gray-600">Select one small section first, then open the full workspace only when needed.</p>
          </div>
          <button
            className={`btn text-white ${fullFeatureView ? 'bg-gray-500' : 'bg-indigo-500'}`}
            onClick={() => setFullFeatureView(prev => !prev)}
          >
            {fullFeatureView ? 'Switch to Compact View' : 'Open Full Feature View'}
          </button>
        </div>

        <div className="quick-windows-grid mt-4">
          {quickPanels.map(panel => (
            <button
              key={panel.id}
              className={`quick-window-btn ${activePanel === panel.id ? 'quick-window-btn-active' : ''}`}
              onClick={() => {
                setActivePanel(panel.id);
                setFullFeatureView(false);
              }}
            >
              <span className="quick-window-title">{panel.label}</span>
              <span className="quick-window-desc">{panel.description}</span>
            </button>
          ))}
        </div>
      </div>

      {fullFeatureView ? (
        <>
          {renderSchemaCard('mb-2')}
          {renderBackupCard('mb-6')}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-7">
            {renderImportCard(false)}
            {renderExportCard()}
          </div>
          {renderTemplateCard('mt-6')}
        </>
      ) : (
        <>
          {activePanel === 'schema' && renderSchemaCard()}
          {activePanel === 'backup' && renderBackupCard()}
          {activePanel === 'import' && renderImportCard(true)}
          {activePanel === 'export' && renderExportCard()}
          {activePanel === 'template' && renderTemplateCard()}
        </>
      )}

      <ConfirmDialog
        open={confirmState.open}
        title={
          confirmState.action === 'export-reset'
            ? t('import.dialog.resetTitle')
            : confirmState.action === 'import-replace'
            ? t('import.dialog.replaceTitle')
            : t('import.dialog.upgradeTitle')
        }
        message={
          confirmState.action === 'export-reset'
            ? t('import.confirm.resetAll')
            : confirmState.action === 'import-replace'
            ? t('import.confirm.replaceAll')
            : t('import.confirm.upgradeV2')
        }
        confirmLabel={t('common.confirm')}
        destructive={confirmState.action !== 'complete-v2-upgrade'}
        onCancel={closeConfirm}
        onConfirm={() => {
          void runConfirmedAction();
        }}
      />

      {previewOpen && (
        <div className="import-preview fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="import-preview-card w-full max-w-6xl max-h-[90vh] rounded-xl shadow-xl border overflow-hidden flex flex-col">
            <div className="import-preview-header flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h3 className="text-xl font-bold">{t('import.preview.title')}</h3>
                <p className="text-sm preview-muted">
                  {t('import.preview.file', { name: pendingFileName || t('import.preview.uploadedFile') })}
                </p>
              </div>
              <button
                onClick={() => setPreviewOpen(false)}
                className="preview-muted hover:opacity-80"
                aria-label={t('common.close')}
                title={t('common.close')}
              >
                <X size={20} />
              </button>
            </div>

            <div className="import-preview-summary px-6 py-4 border-b">
              <div className="flex flex-wrap gap-4 items-center text-sm">
                <span className="preview-badge preview-add">{t('import.preview.added', { count: previewSummary.added })}</span>
                <span className="preview-badge preview-update">{t('import.preview.updated', { count: previewSummary.updated })}</span>
                <span className="preview-badge preview-neutral">{t('import.preview.removed', { count: previewSummary.removed })}</span>
                {previewSummary.errors > 0 && (
                  <span className="preview-badge preview-error">{t('import.preview.errors', { count: previewSummary.errors })}</span>
                )}
              </div>
              <div className="text-xs preview-muted mt-2">
                {t('import.preview.changesHint')}
              </div>
            </div>

            <div className="flex-1 overflow-auto">
              <table className="import-preview-table min-w-full text-sm">
                <thead className="sticky top-0 import-preview-thead border-b">
                  <tr>
                    <th className="p-3 text-left text-xs font-bold preview-muted">{t('common.row')}</th>
                    <th className="p-3 text-left text-xs font-bold preview-muted">{t('common.status')}</th>
                    {previewHeaders.map((h, idx) => (
                      <th key={idx} className="p-3 text-left text-xs font-bold preview-muted">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, idx) => (
                    <tr
                      key={idx}
                      className={
                        row.status === 'add'
                          ? 'preview-row preview-row-add border-b'
                          : row.status === 'update'
                          ? 'preview-row preview-row-update border-b'
                          : 'preview-row preview-row-error border-b'
                      }
                    >
                      <td className="p-3 text-xs preview-muted">{row.rowNum}</td>
                      <td className="p-3 text-xs font-bold">
                        {row.status === 'add' && t('import.preview.status.add')}
                        {row.status === 'update' && t('import.preview.status.update')}
                        {row.status === 'error' && t('import.preview.status.error')}
                      </td>
                      {previewHeaders.map((h, hIdx) => (
                        <td key={hIdx} className="p-3 whitespace-nowrap">
                          {row.data[h] || ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="import-preview-footer px-6 py-4 border-t">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-bold mb-2">{t('import.preview.systemChanges')}</p>
                  <ul className="text-xs preview-muted max-h-28 overflow-y-auto list-disc ml-4">
                    {previewRows.flatMap(r => r.changes.map((c, i) => (
                      <li key={`${r.rowNum}-${i}`}>{t('import.preview.rowLabel', { row: r.rowNum })}: {c}</li>
                    )))}
                    {previewRows.every(r => r.changes.length === 0) && (
                      <li>{t('import.preview.noChanges')}</li>
                    )}
                  </ul>
                </div>
                <div>
                  <p className="text-sm font-bold mb-2">{t('import.preview.errorsTitle')}</p>
                  <ul className="text-xs preview-error-text max-h-28 overflow-y-auto list-disc ml-4">
                    {previewRows.flatMap(r => r.errors.map((e, i) => (
                      <li key={`${r.rowNum}-err-${i}`}>{t('import.preview.rowLabel', { row: r.rowNum })}: {e}</li>
                    )))}
                    {previewSummary.errors === 0 && <li className="preview-muted">{t('import.preview.noErrors')}</li>}
                  </ul>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-4">
                <button
                  onClick={() => setPreviewOpen(false)}
                  className="btn bg-gray-100"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={applyImport}
                  className={`btn text-white ${previewSummary.errors > 0 ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-500'}`}
                  disabled={previewSummary.errors > 0 || importing}
                >
                  {importing ? t('import.preview.applying') : t('import.preview.apply')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
