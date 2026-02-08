import { useState } from 'react';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import JSZip from 'jszip';
import { Download, Upload, FileSpreadsheet, AlertCircle, CheckCircle, X } from 'lucide-react';
import { useI18n } from '../contexts/useI18n';

type ImportType = 'transactions' | 'loans' | 'bills';

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

export const ImportExportPage = () => {
  const { t } = useI18n();
  const [importType, setImportType] = useState<ImportType>('transactions');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [zipBusy, setZipBusy] = useState(false);
  const [zipMessage, setZipMessage] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [previewSummary, setPreviewSummary] = useState({ added: 0, updated: 0, removed: 0, errors: 0 });
  const [pendingHeaders, setPendingHeaders] = useState<string[]>([]);
  const [pendingRows, setPendingRows] = useState<string[][]>([]);
  const [pendingFileName, setPendingFileName] = useState<string>('');

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

  const downloadTemplate = (type: ImportType) => {
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

    const csv = template.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const parseCSV = (text: string): string[][] => {
    const lines = text.split('\n').filter(line => line.trim());
    return lines.map(line => {
      const cells: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          cells.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      cells.push(current.trim());
      return cells;
    });
  };

  const columnLetter = (index: number) => {
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
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false }) as (string | number | boolean | null)[][];
      return data
        .filter((row: (string | number | boolean | null)[]) => row.some((cell: string | number | boolean | null) => String(cell ?? '').trim() !== ''))
        .map((row: (string | number | boolean | null)[]) => row.map((cell: string | number | boolean | null) => String(cell ?? '').trim()));
    }

    if (extension === 'docx') {
      const buffer = await file.arrayBuffer();
      const htmlResult = await mammoth.convertToHtml({ arrayBuffer: buffer });
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlResult.value, 'text/html');
      const table = doc.querySelector('table');

      if (table) {
        const rows = Array.from(table.querySelectorAll('tr')).map((tr) =>
          Array.from(tr.querySelectorAll('th, td')).map((cell) => cell.textContent?.trim() || '')
        );
        return rows.filter((row) => row.some((cell) => cell.trim() !== ''));
      }

      const textResult = await mammoth.extractRawText({ arrayBuffer: buffer });
      return parseCSV(textResult.value);
    }

    throw new Error(t('import.errors.unsupportedFile'));
  };

  const buildPreview = async (headers: string[], dataRows: string[][]) => {
    if (!window.electron) {
      throw new Error(t('import.errors.electronUnavailable'));
    }

    const [accounts, categories, existingTransactions, existingLoans, existingBills] = await Promise.all([
      window.electron.invoke('db-get-accounts'),
      window.electron.invoke('db-get-categories'),
      window.electron.invoke('db-get-transactions', {}),
      window.electron.invoke('db-get-loans'),
      window.electron.invoke('db-get-bills')
    ]);

    const existingMap: Record<string, Record<string, unknown>> = {};
    if (importType === 'transactions') {
      (existingTransactions as Record<string, unknown>[]).forEach(item => {
        if (item.id) existingMap[String(item.id)] = item;
      });
    }
    if (importType === 'loans') {
      (existingLoans as Record<string, unknown>[]).forEach(item => {
        if (item.id) existingMap[String(item.id)] = item;
      });
    }
    if (importType === 'bills') {
      (existingBills as Record<string, unknown>[]).forEach(item => {
        if (item.id) existingMap[String(item.id)] = item;
      });
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
        data[header] = row[idx] || '';
      });

      const rowErrors: string[] = [];
      const changes: string[] = [];
      if (!data.id || !data.id.trim()) {
        rowErrors.push(t('import.errors.idRequired'));
      }
      const existing = data.id ? existingMap[data.id] : undefined;

      if (importType === 'transactions') {
        const account = accounts.find((a: { name: string }) =>
          a.name.toLowerCase() === data.account?.toLowerCase()
        );
        if (!account) {
          rowErrors.push(t('import.errors.accountNotFound', { name: data.account }));
        }

        if (data.type !== 'transfer' && data.category) {
          const category = categories.find((c: { name: string }) =>
            c.name.toLowerCase() === data.category?.toLowerCase()
          );
          if (!category) {
            rowErrors.push(t('import.errors.categoryNotFound', { name: data.category }));
          }
        }

        if (data.type === 'transfer' && data.to_account) {
          const toAccount = accounts.find((a: { name: string }) =>
            a.name.toLowerCase() === data.to_account?.toLowerCase()
          );
          if (!toAccount) {
            rowErrors.push(t('import.errors.toAccountNotFound', { name: data.to_account }));
          }
        }
      }

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

      let status: PreviewStatus = 'add';
      if (existing) status = 'update';
      if (rowErrors.length > 0) status = 'error';

      if (status === 'add') added++;
      if (status === 'update') updated++;
      if (status === 'error') errorsCount++;

      preview.push({ rowNum, status, data, changes, errors: rowErrors });
    }

    setPreviewRows(preview);
    setPreviewSummary({ added, updated, removed: 0, errors: errorsCount });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setResult(null);

    try {
      const rows = await readFileToRows(file);

      if (rows.length < 2) {
        throw new Error('File must contain header row and at least one data row');
      }

      const headers = rows[0].map(h => h.toLowerCase());
      const dataRows = rows.slice(1);

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
        errors: [error instanceof Error ? error.message : 'Unknown error occurred']
      });
    } finally {
      setImporting(false);
      event.target.value = '';
    }
  };

  const applyImport = async () => {
    if (!window.electron) return;
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

      const [accounts, categories, existingTransactions, existingLoans, existingBills] = await Promise.all([
        window.electron.invoke('db-get-accounts'),
        window.electron.invoke('db-get-categories'),
        window.electron.invoke('db-get-transactions', {}),
        window.electron.invoke('db-get-loans'),
        window.electron.invoke('db-get-bills')
      ]);

      const existingMap: Record<string, Record<string, unknown>> = {};
      if (importType === 'transactions') {
        (existingTransactions as Record<string, unknown>[]).forEach(item => {
          if (item.id) existingMap[String(item.id)] = item;
        });
      }
      if (importType === 'loans') {
        (existingLoans as Record<string, unknown>[]).forEach(item => {
          if (item.id) existingMap[String(item.id)] = item;
        });
      }
      if (importType === 'bills') {
        (existingBills as Record<string, unknown>[]).forEach(item => {
          if (item.id) existingMap[String(item.id)] = item;
        });
      }

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const rowNum = i + 2;

        try {
          const data: Record<string, string> = {};
          headers.forEach((header, idx) => {
            data[header] = row[idx] || '';
          });

          if (!data.id || !data.id.trim()) {
            throw new Error(t('import.errors.idRequired'));
          }
          importedIds.push(data.id.trim());

          if (importType === 'transactions') {
            const account = accounts.find((a: { name: string }) =>
              a.name.toLowerCase() === data.account?.toLowerCase()
            );
            if (!account) {
              throw new Error(t('import.errors.accountNotFound', { name: data.account }));
            }

            let category = null;
            if (data.type !== 'transfer' && data.category) {
              category = categories.find((c: { name: string }) =>
                c.name.toLowerCase() === data.category?.toLowerCase()
              );
              if (!category) {
                throw new Error(t('import.errors.categoryNotFound', { name: data.category }));
              }
            }

            let toAccount = null;
            if (data.type === 'transfer' && data.to_account) {
              toAccount = accounts.find((a: { name: string }) =>
                a.name.toLowerCase() === data.to_account?.toLowerCase()
              );
              if (!toAccount) {
                throw new Error(t('import.errors.toAccountNotFound', { name: data.to_account }));
              }
            }

            const transaction = {
              id: data.id,
              date: data.date,
              merchant: data.merchant,
              amount: parseFloat(data.amount),
              type: data.type,
              category: category?.id,
              accountId: account.id,
              toAccountId: toAccount?.id || null,
              notes: data.notes || ''
            };

            const exists = !!existingMap[data.id];
            if (exists) {
              await window.electron.invoke('db-update-transaction', transaction);
              updated++;
            } else {
              await window.electron.invoke('db-add-transaction', transaction);
              success++;
            }
          } else if (importType === 'loans') {
            const loan = {
              id: data.id,
              name: data.name,
              lender: data.lender,
              principal_amount: parseFloat(data.principal_amount),
              current_balance: parseFloat(data.current_balance),
              interest_rate: parseFloat(data.interest_rate),
              payment_amount: parseFloat(data.payment_amount),
              payment_frequency: data.payment_frequency,
              start_date: data.start_date,
              end_date: data.end_date || null,
              notes: data.notes || ''
            };

            await window.electron.invoke('db-save-loan', loan);
            if (existingMap[data.id]) {
              updated++;
            } else {
              success++;
            }
          } else if (importType === 'bills') {
            const bill = {
              id: data.id,
              name: data.name,
              amount: parseFloat(data.amount),
              next_due_date: data.next_due_date,
              recurrence: data.recurrence,
              is_paid: data.is_paid === 'true' ? 1 : 0,
              auto_pay: data.auto_pay === 'true' ? 1 : 0
            };

            await window.electron.invoke('db-save-bill', bill);
            if (existingMap[data.id]) {
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

  const exportData = async (type: ImportType) => {
    if (!window.electron) return;

    try {
      let data: Record<string, unknown>[] = [];
      let headers: string[];
      let filename: string;

      switch (type) {
        case 'transactions': {
          data = await window.electron.invoke('db-get-transactions', {});
          headers = ['id', 'date', 'merchant', 'amount', 'type', 'category_name', 'account_name', 'to_account_name', 'notes'];
          filename = `transactions_export_${new Date().toISOString().split('T')[0]}.csv`;
          break;
        }
        case 'loans': {
          data = await window.electron.invoke('db-get-loans');
          headers = ['id', 'name', 'lender', 'principal_amount', 'current_balance', 'interest_rate', 'payment_amount', 'payment_frequency', 'start_date', 'end_date', 'notes'];
          filename = `loans_export_${new Date().toISOString().split('T')[0]}.csv`;
          break;
        }
        case 'bills': {
          data = await window.electron.invoke('db-get-bills');
          headers = ['id', 'name', 'amount', 'next_due_date', 'recurrence', 'is_paid', 'auto_pay'];
          filename = `bills_export_${new Date().toISOString().split('T')[0]}.csv`;
          break;
        }
      }

      const rows = [headers, ...data.map(item => 
        headers.map(h => String(item[h] || ''))
      )];

      const csv = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      alert(t('import.exportFailed', { error: error instanceof Error ? error.message : t('import.errors.unknown') }));
    }
  };

  const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  };

  const base64ToArrayBuffer = (base64: string) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  };

  const exportAllDataZip = async (resetAfter = false) => {
    if (!window.electron) return;
    const confirmed = resetAfter
      ? confirm(t('import.confirm.resetAll'))
      : true;
    if (!confirmed) return;

    try {
      setZipBusy(true);
      setZipMessage(null);

      const [accounts, categories, transactions, budgets, goals, bills, loans, plans, tax_rules, app_settings] = await Promise.all([
        window.electron.invoke('db-get-accounts'),
        window.electron.invoke('db-get-categories'),
        window.electron.invoke('db-get-transactions', {}),
        window.electron.invoke('db-get-budgets'),
        window.electron.invoke('db-get-goals'),
        window.electron.invoke('db-get-bills'),
        window.electron.invoke('db-get-loans'),
        window.electron.invoke('db-get-plans'),
        window.electron.invoke('db-get-tax-rules').catch(() => []),
        window.electron.invoke('db-get-app-settings').catch(() => [])
      ]);

      const payload = {
        accounts,
        categories,
        transactions,
        budgets,
        goals,
        bills,
        loans,
        plans,
        tax_rules,
        app_settings
      };

      const zip = new JSZip();
      zip.file('backup.json', JSON.stringify(payload, null, 2));
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      const buffer = await blob.arrayBuffer();
      const dataBase64 = arrayBufferToBase64(buffer);
      const defaultPath = `finance_backup_${new Date().toISOString().split('T')[0]}.zip`;

      const saveResult = await window.electron.invoke('app-save-zip', { defaultPath, dataBase64 });
      if (saveResult?.canceled) {
        setZipMessage(t('import.exportCanceled'));
        return;
      }

      if (resetAfter) {
        await window.electron.invoke('db-reset-all');
        setZipMessage(t('import.resetDone'));
      } else {
        setZipMessage(t('import.exportSuccess'));
      }
    } catch (error) {
      setZipMessage(t('import.exportFailed', { error: error instanceof Error ? error.message : t('import.errors.unknown') }));
    } finally {
      setZipBusy(false);
    }
  };

  const importAllDataZip = async (fileOrBase64: File | string) => {
    if (!window.electron) return;
    const confirmed = confirm(t('import.confirm.replaceAll'));
    if (!confirmed) return;

    try {
      setZipBusy(true);
      setZipMessage(null);

      const buffer = typeof fileOrBase64 === 'string'
        ? base64ToArrayBuffer(fileOrBase64)
        : await fileOrBase64.arrayBuffer();
      const zip = await JSZip.loadAsync(buffer);
      const backupFile = zip.file('backup.json');
      if (!backupFile) throw new Error('backup.json not found in zip');

      const text = await backupFile.async('string');
      const payload = JSON.parse(text);

      await window.electron.invoke('db-reset-all');
      await window.electron.invoke('db-restore-all', payload);
      setZipMessage(t('import.importSuccess'));
    } catch (error) {
      setZipMessage(t('import.importFailed', { error: error instanceof Error ? error.message : t('import.errors.unknown') }));
    } finally {
      setZipBusy(false);
    }
  };

  return (
    <div className="min-h-screen w-full max-w-5xl mx-auto px-6 py-6 flex flex-col gap-6">
      <h2 className="text-3xl font-bold font-heading mb-6">{t('import.title')}</h2>

      <div className="card mb-6 zip-card">
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
            onClick={() => exportAllDataZip(true)}
            className="btn bg-red-500 text-white"
            disabled={zipBusy}
          >
            {t('import.exportResetZip')}
          </button>
          <button
            className="btn bg-gray-100"
            disabled={zipBusy}
            onClick={async () => {
              if (!window.electron) return;
              const result = await window.electron.invoke('app-open-zip');
              if (!result || result.canceled || !result.dataBase64) return;
              await importAllDataZip(result.dataBase64);
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Import Section */}
        <div className="card">
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

        {/* Export Section */}
        <div className="card">
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
      </div>

      {/* Template Format Reference */}
      <div className="card mt-6">
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
