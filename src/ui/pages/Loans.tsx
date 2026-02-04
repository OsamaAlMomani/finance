import { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { PlusCircle, Trash2, Edit2, AlertTriangle } from 'lucide-react';

interface Loan {
  id: string;
  name: string;
  principal_amount: number;
  current_balance: number;
  interest_rate: number;
  payment_amount: number;
  payment_frequency: 'monthly' | 'biweekly' | 'weekly';
  start_date: string;
  end_date: string;
  lender: string;
  notes?: string;
}

export const LoansPage = () => {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);

  const [loanForm, setLoanForm] = useState<{
    name: string;
    principal_amount: string;
    current_balance: string;
    interest_rate: string;
    payment_amount: string;
    payment_frequency: 'monthly' | 'biweekly' | 'weekly';
    start_date: string;
    end_date: string;
    lender: string;
    notes: string;
  }>({
    name: '',
    principal_amount: '',
    current_balance: '',
    interest_rate: '',
    payment_amount: '',
    payment_frequency: 'monthly',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    lender: '',
    notes: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    if (!window.electron) return;
    try {
      const loansData = await window.electron.invoke('db-get-loans');
      setLoans(loansData || []);
    } catch (e) {
      console.error('Failed to load loans:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (loan?: Loan) => {
    if (loan) {
      setEditingLoan(loan);
      setLoanForm({
        name: loan.name,
        principal_amount: loan.principal_amount.toString(),
        current_balance: loan.current_balance.toString(),
        interest_rate: loan.interest_rate.toString(),
        payment_amount: loan.payment_amount.toString(),
        payment_frequency: loan.payment_frequency,
        start_date: loan.start_date,
        end_date: loan.end_date,
        lender: loan.lender,
        notes: loan.notes || ''
      });
    } else {
      setEditingLoan(null);
      setLoanForm({
        name: '',
        principal_amount: '',
        current_balance: '',
        interest_rate: '',
        payment_amount: '',
        payment_frequency: 'monthly',
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
        lender: '',
        notes: ''
      });
    }
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.electron) return;

    await window.electron.invoke('db-save-loan', {
      id: editingLoan ? editingLoan.id : uuidv4(),
      name: loanForm.name,
      principal_amount: parseFloat(loanForm.principal_amount),
      current_balance: parseFloat(loanForm.current_balance),
      interest_rate: parseFloat(loanForm.interest_rate),
      payment_amount: parseFloat(loanForm.payment_amount),
      payment_frequency: loanForm.payment_frequency,
      start_date: loanForm.start_date,
      end_date: loanForm.end_date,
      lender: loanForm.lender,
      notes: loanForm.notes
    });

    setShowModal(false);
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this loan?")) return;
    if (!window.electron) return;
    await window.electron.invoke('db-delete-loan', id);
    loadData();
  };

  const calculateMonthlyInterest = (balance: number, annualRate: number) => {
    return (balance * (annualRate / 100)) / 12;
  };

  const calculateProgress = (loan: Loan) => {
    return ((loan.principal_amount - loan.current_balance) / loan.principal_amount) * 100;
  };

  if (loading) return <div>Loading...</div>;

  const totalDebt = loans.reduce((sum, loan) => sum + loan.current_balance, 0);
  const monthlyInterest = loans.reduce((sum, loan) => sum + calculateMonthlyInterest(loan.current_balance, loan.interest_rate), 0);
  const highInterestLoans = loans.filter(loan => loan.interest_rate > 7).length;

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold font-heading">Loans & Debts</h2>
        <button onClick={() => handleOpenModal()} className="btn bg-red-500 text-white flex items-center gap-2">
          <PlusCircle size={20} /> Add Loan
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card bg-gradient-to-br from-red-50 to-white border-red-200">
          <p className="text-sm text-gray-500 font-bold uppercase mb-1">Total Debt</p>
          <p className="text-3xl font-bold text-red-600">${totalDebt.toFixed(2)}</p>
        </div>
        <div className="card bg-gradient-to-br from-yellow-50 to-white border-yellow-200">
          <p className="text-sm text-gray-500 font-bold uppercase mb-1">Monthly Interest</p>
          <p className="text-3xl font-bold text-yellow-600">${monthlyInterest.toFixed(2)}</p>
        </div>
        <div className="card bg-gradient-to-br from-orange-50 to-white border-orange-200">
          <p className="text-sm text-gray-500 font-bold uppercase mb-1">High Interest Loans</p>
          <p className="text-3xl font-bold text-orange-600">{highInterestLoans}</p>
          <p className="text-xs text-gray-400">(&gt;7% APR)</p>
        </div>
      </div>

      {/* Loans List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {loans.map(loan => {
          const progress = calculateProgress(loan);
          const monthlyInt = calculateMonthlyInterest(loan.current_balance, loan.interest_rate);
          const isHighInterest = loan.interest_rate > 7;
          return (
            <div key={loan.id} className={`card relative overflow-hidden group ${
              isHighInterest ? 'border-2 border-orange-400 bg-orange-50' : ''
            }`}>
              {isHighInterest && (
                <div className="bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full absolute top-2 right-2 z-10 flex items-center gap-1">
                  <AlertTriangle size={12} /> HIGH RATE
                </div>
              )}
              
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-xl">{loan.name}</h3>
                  <p className="text-sm text-gray-500">{loan.lender}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleOpenModal(loan)}
                    className="text-blue-300 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label={`Edit loan ${loan.name}`}
                    title="Edit loan"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(loan.id)}
                    className="text-red-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label={`Delete loan ${loan.name}`}
                    title="Delete loan"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-xs text-gray-400 uppercase">Current Balance</p>
                  <p className="text-2xl font-bold text-red-600">${loan.current_balance.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase">Interest Rate</p>
                  <p className={`text-2xl font-bold ${isHighInterest ? 'text-orange-600' : 'text-gray-700'}`}>
                    {loan.interest_rate.toFixed(2)}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase">Payment</p>
                  <p className="text-lg font-bold text-gray-700">
                    ${loan.payment_amount.toFixed(2)}
                    <span className="text-xs text-gray-400 ml-1">/{loan.payment_frequency}</span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase">Monthly Interest</p>
                  <p className="text-lg font-bold text-yellow-600">${monthlyInt.toFixed(2)}</p>
                </div>
              </div>

              <div className="mb-2">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-500">Progress</span>
                  <span className="font-bold text-green-600">{progress.toFixed(1)}% paid off</span>
                </div>
                <progress
                  className="progress-bar bg-gray-200"
                  value={Math.min(progress, 100)}
                  max={100}
                />
              </div>

              {loan.notes && (
                <p className="text-sm text-gray-500 mt-2 italic">{loan.notes}</p>
              )}
            </div>
          );
        })}

        {loans.length === 0 && (
          <div className="col-span-2 text-center py-12 text-gray-400 border-2 border-dashed border-gray-300 rounded-xl">
            <p className="text-xl font-hand">No loans tracked. Great job staying debt-free!</p>
          </div>
        )}
      </div>

      {/* Loan Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-2xl border-2 border-gray-200 max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold mb-4 font-heading">
              {editingLoan ? 'Edit Loan' : 'Add New Loan'}
            </h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="loan-name" className="block text-sm font-bold mb-1">Loan Name</label>
                  <input
                    id="loan-name"
                    className="w-full p-2 border rounded font-hand text-lg"
                    placeholder="e.g. Student Loan, Mortgage"
                    required
                    value={loanForm.name}
                    onChange={e => setLoanForm({...loanForm, name: e.target.value})}
                  />
                </div>
                <div>
                  <label htmlFor="loan-lender" className="block text-sm font-bold mb-1">Lender</label>
                  <input
                    id="loan-lender"
                    className="w-full p-2 border rounded font-hand text-lg"
                    placeholder="e.g. Bank Name"
                    required
                    value={loanForm.lender}
                    onChange={e => setLoanForm({...loanForm, lender: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="loan-principal" className="block text-sm font-bold mb-1">Original Amount</label>
                  <input
                    id="loan-principal"
                    type="number"
                    step="0.01"
                    className="w-full p-2 border rounded font-hand text-lg"
                    placeholder="0.00"
                    required
                    value={loanForm.principal_amount}
                    onChange={e => setLoanForm({...loanForm, principal_amount: e.target.value})}
                  />
                </div>
                <div>
                  <label htmlFor="loan-balance" className="block text-sm font-bold mb-1">Current Balance</label>
                  <input
                    id="loan-balance"
                    type="number"
                    step="0.01"
                    className="w-full p-2 border rounded font-hand text-lg"
                    placeholder="0.00"
                    required
                    value={loanForm.current_balance}
                    onChange={e => setLoanForm({...loanForm, current_balance: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="loan-rate" className="block text-sm font-bold mb-1">Interest Rate (%)</label>
                  <input
                    id="loan-rate"
                    type="number"
                    step="0.01"
                    className="w-full p-2 border rounded font-hand text-lg"
                    placeholder="5.50"
                    required
                    value={loanForm.interest_rate}
                    onChange={e => setLoanForm({...loanForm, interest_rate: e.target.value})}
                  />
                </div>
                <div>
                  <label htmlFor="loan-payment" className="block text-sm font-bold mb-1">Payment Amount</label>
                  <input
                    id="loan-payment"
                    type="number"
                    step="0.01"
                    className="w-full p-2 border rounded font-hand text-lg"
                    placeholder="0.00"
                    required
                    value={loanForm.payment_amount}
                    onChange={e => setLoanForm({...loanForm, payment_amount: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label htmlFor="loan-frequency" className="block text-sm font-bold mb-1">Payment Frequency</label>
                  <select
                    id="loan-frequency"
                    className="w-full p-2 border rounded font-hand text-lg"
                    value={loanForm.payment_frequency}
                    onChange={e => setLoanForm({...loanForm, payment_frequency: e.target.value as 'monthly' | 'biweekly' | 'weekly'})}
                  >
                    <option value="monthly">Monthly</option>
                    <option value="biweekly">Bi-weekly</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="loan-start" className="block text-sm font-bold mb-1">Start Date</label>
                  <input
                    id="loan-start"
                    type="date"
                    className="w-full p-2 border rounded font-hand text-lg"
                    required
                    value={loanForm.start_date}
                    onChange={e => setLoanForm({...loanForm, start_date: e.target.value})}
                  />
                </div>
                <div>
                  <label htmlFor="loan-end" className="block text-sm font-bold mb-1">End Date</label>
                  <input
                    id="loan-end"
                    type="date"
                    className="w-full p-2 border rounded font-hand text-lg"
                    value={loanForm.end_date}
                    onChange={e => setLoanForm({...loanForm, end_date: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="loan-notes" className="block text-sm font-bold mb-1">Notes</label>
                <textarea
                  id="loan-notes"
                  className="w-full p-2 border rounded font-hand text-lg"
                  rows={2}
                  placeholder="Optional notes about this loan"
                  value={loanForm.notes}
                  onChange={e => setLoanForm({...loanForm, notes: e.target.value})}
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 btn bg-gray-100">
                  Cancel
                </button>
                <button type="submit" className="flex-1 btn bg-red-500 text-white">
                  {editingLoan ? 'Update' : 'Add Loan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
