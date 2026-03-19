import { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

interface Scenario {
  id: string;
  title: string;
  assumptions?: Record<string, unknown>;
  result_snapshot?: {
    summary?: {
      finalBalance?: number;
      lowestBalance?: number;
      riskLevel?: string;
      riskNotes?: string[];
    };
    timeline?: Array<{
      month: string;
      net: number;
      projectedBalance: number;
    }>;
  };
  risk_level?: string;
}

export const ScenariosPage = () => {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [form, setForm] = useState({
    title: '',
    months: '6',
    monthlyIncome: '0',
    monthlyExpense: '0',
    extraMonthlyExpense: '0',
    oneOffExpense: '0',
    incomeDelta: '0',
    expenseDelta: '0'
  });
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);

  const load = async () => {
    if (!window.electron) return;
    setLoading(true);
    try {
      const data = await window.electron.invoke('db-get-scenarios');
      setScenarios(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const assumptions = {
    duration_months: Number(form.months || 6),
    monthly_income: Number(form.monthlyIncome || 0),
    monthly_expense: Number(form.monthlyExpense || 0),
    extra_monthly_expense: Number(form.extraMonthlyExpense || 0),
    one_off_expense: Number(form.oneOffExpense || 0),
    income_delta: Number(form.incomeDelta || 0),
    expense_delta: Number(form.expenseDelta || 0)
  };

  const runPreview = async () => {
    if (!window.electron) return;
    setRunning(true);
    try {
      const result = await window.electron.invoke('db-run-scenario', assumptions);
      setPreview(result);
    } finally {
      setRunning(false);
    }
  };

  const saveScenario = async () => {
    if (!window.electron) return;
    if (!form.title.trim()) return;
    setRunning(true);
    try {
      const result = await window.electron.invoke('db-run-scenario', assumptions);
      await window.electron.invoke('db-save-scenario', {
        id: uuidv4(),
        title: form.title,
        assumptions,
        result_snapshot_json: result
      });
      setForm((prev) => ({ ...prev, title: '' }));
      setPreview(result);
      window.dispatchEvent(new CustomEvent('finance:data-changed'));
      await load();
    } finally {
      setRunning(false);
    }
  };

  const deleteScenario = async (id: string) => {
    if (!window.electron) return;
    if (!confirm('Delete this scenario?')) return;
    await window.electron.invoke('db-delete-scenario', id);
    window.dispatchEvent(new CustomEvent('finance:data-changed'));
    await load();
  };

  return (
    <div className="h-full flex flex-col gap-4 overflow-hidden">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold font-heading">Scenarios</h2>
      </div>

      <div className="card">
        <h3 className="text-xl font-bold mb-3">What-if Simulator</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-3">
            <label htmlFor="scenario-title" className="block text-sm font-bold mb-1">Scenario Title</label>
            <input
              id="scenario-title"
              className="w-full p-2 border rounded"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Cut food spending by 15%"
            />
          </div>

          <div>
            <label htmlFor="scenario-months" className="block text-sm font-bold mb-1">Duration (months)</label>
            <input id="scenario-months" type="number" min={1} className="w-full p-2 border rounded" value={form.months} onChange={(e) => setForm({ ...form, months: e.target.value })} />
          </div>
          <div>
            <label htmlFor="scenario-income" className="block text-sm font-bold mb-1">Monthly Income</label>
            <input id="scenario-income" type="number" className="w-full p-2 border rounded" value={form.monthlyIncome} onChange={(e) => setForm({ ...form, monthlyIncome: e.target.value })} />
          </div>
          <div>
            <label htmlFor="scenario-expense" className="block text-sm font-bold mb-1">Monthly Expense</label>
            <input id="scenario-expense" type="number" className="w-full p-2 border rounded" value={form.monthlyExpense} onChange={(e) => setForm({ ...form, monthlyExpense: e.target.value })} />
          </div>

          <div>
            <label htmlFor="scenario-extra" className="block text-sm font-bold mb-1">Extra Monthly Expense</label>
            <input id="scenario-extra" type="number" className="w-full p-2 border rounded" value={form.extraMonthlyExpense} onChange={(e) => setForm({ ...form, extraMonthlyExpense: e.target.value })} />
          </div>
          <div>
            <label htmlFor="scenario-oneoff" className="block text-sm font-bold mb-1">One-off Expense</label>
            <input id="scenario-oneoff" type="number" className="w-full p-2 border rounded" value={form.oneOffExpense} onChange={(e) => setForm({ ...form, oneOffExpense: e.target.value })} />
          </div>
          <div>
            <label htmlFor="scenario-income-delta" className="block text-sm font-bold mb-1">Income Delta / month</label>
            <input id="scenario-income-delta" type="number" className="w-full p-2 border rounded" value={form.incomeDelta} onChange={(e) => setForm({ ...form, incomeDelta: e.target.value })} />
          </div>
          <div>
            <label htmlFor="scenario-expense-delta" className="block text-sm font-bold mb-1">Expense Delta / month</label>
            <input id="scenario-expense-delta" type="number" className="w-full p-2 border rounded" value={form.expenseDelta} onChange={(e) => setForm({ ...form, expenseDelta: e.target.value })} />
          </div>
        </div>

        <div className="flex gap-3 mt-4">
          <button className="btn bg-blue-500 text-white" onClick={runPreview} disabled={running}>Run Preview</button>
          <button className="btn bg-indigo-500 text-white" onClick={saveScenario} disabled={running || !form.title.trim()}>Save Scenario</button>
        </div>

        {preview && (
          <div className="mt-4 p-3 rounded border bg-gray-50">
            <p className="font-bold">Preview Result</p>
            <p className="text-sm">Final Balance: {Number((preview.summary as { finalBalance?: number })?.finalBalance || 0).toFixed(2)}</p>
            <p className="text-sm">Lowest Balance: {Number((preview.summary as { lowestBalance?: number })?.lowestBalance || 0).toFixed(2)}</p>
            <p className="text-sm">Risk: {(preview.summary as { riskLevel?: string })?.riskLevel || 'low'}</p>
          </div>
        )}
      </div>

      <div className="card overflow-y-auto">
        <h3 className="text-xl font-bold mb-3">Saved Scenarios</h3>
        {loading ? (
          <div>Loading...</div>
        ) : (
          <div className="space-y-3">
            {scenarios.map((scenario) => (
              <div key={scenario.id} className="border rounded p-3">
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <p className="font-bold">{scenario.title}</p>
                    <p className="text-xs text-gray-500">Risk: {scenario.result_snapshot?.summary?.riskLevel || scenario.risk_level || 'low'}</p>
                    <p className="text-xs text-gray-500">Final balance: {Number(scenario.result_snapshot?.summary?.finalBalance || 0).toFixed(2)}</p>
                  </div>
                  <button className="btn bg-red-100" onClick={() => deleteScenario(scenario.id)}>Delete</button>
                </div>
              </div>
            ))}

            {scenarios.length === 0 && (
              <div className="text-sm text-gray-500">No scenarios saved yet.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
