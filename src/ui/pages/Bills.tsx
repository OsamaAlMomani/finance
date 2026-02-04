import { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Calendar, CheckCircle, Clock, AlertCircle, Trash2, Edit2 } from 'lucide-react';

interface Bill {
  id: string;
  name: string;
  amount: number;
  next_due_date: string;
  recurrence: string;
  is_paid: boolean;
  auto_pay: boolean;
}

export const BillsPage = () => {
    const [bills, setBills] = useState<Bill[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [editingBill, setEditingBill] = useState<Bill | null>(null);
    const [newBill, setNewBill] = useState({
        name: '', amount: '', date: '', recur: 'monthly'
    });

    const loadBills = () => {
        if(window.electron) window.electron.invoke('db-get-bills').then(setBills);
    };

    useEffect(() => { loadBills(); }, []);

    const handleOpenModal = (bill?: Bill) => {
        if (bill) {
            setEditingBill(bill);
            setNewBill({
                name: bill.name,
                amount: bill.amount.toString(),
                date: bill.next_due_date,
                recur: bill.recurrence
            });
        } else {
            setEditingBill(null);
            setNewBill({ name: '', amount: '', date: '', recur: 'monthly' });
        }
        setShowModal(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!window.electron) return;
        await window.electron.invoke('db-save-bill', {
            id: editingBill ? editingBill.id : uuidv4(),
            name: newBill.name,
            amount: parseFloat(newBill.amount),
            next_due_date: newBill.date,
            recurrence: newBill.recur,
            is_paid: editingBill ? editingBill.is_paid : false,
            auto_pay: editingBill ? editingBill.auto_pay : false
        });
        setShowModal(false);
        loadBills();
    };

    const togglePaid = async (bill: Bill) => {
        if(!window.electron) return;
        await window.electron.invoke('db-save-bill', {
            ...bill,
            is_paid: !bill.is_paid
        });
        loadBills();
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this bill?")) return;
        if (!window.electron) return;
        await window.electron.invoke('db-delete-bill', id);
        loadBills();
    };

    return (
        <div className="h-full">
             <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold font-heading">Upcoming Bills</h2>
                <button onClick={() => handleOpenModal()} className="btn bg-red-400 text-white flex items-center gap-2">
                    <Calendar size={20} /> Add Bill
                </button>
            </div>

            <div className="space-y-4">
                {bills.map(b => (
                    <div key={b.id} className={`card flex items-center justify-between p-4 group ${b.is_paid ? 'opacity-60 bg-gray-50' : 'border-l-4 border-red-400'}`}>
                        <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-full ${b.is_paid ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                {b.is_paid ? <CheckCircle /> : <AlertCircle />}
                            </div>
                            <div>
                                <h3 className={`font-bold text-lg ${b.is_paid ? 'line-through text-gray-500' : ''}`}>{b.name}</h3>
                                <p className="text-sm text-gray-400 flex items-center gap-1">
                                    <Clock size={14} /> Due: {b.next_due_date} ({b.recurrence})
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <span className="font-mono font-bold text-xl">${b.amount}</span>
                            <button 
                                onClick={() => togglePaid(b)}
                                className={`btn text-sm ${b.is_paid ? 'bg-gray-200' : 'bg-green-500 text-white'}`}
                            >
                                {b.is_paid ? 'Mark Unpaid' : 'Mark Paid'}
                            </button>
                            <button
                                onClick={() => handleOpenModal(b)}
                                className="text-gray-400 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                aria-label={`Edit bill ${b.name}`}
                                title="Edit bill"
                            >
                                <Edit2 size={18} />
                            </button>
                            <button
                                onClick={() => handleDelete(b.id)}
                                className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                aria-label={`Delete bill ${b.name}`}
                                title="Delete bill"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

             {showModal && (
                <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-sm">
                        <h3 className="text-2xl font-bold mb-4 font-heading">
                            {editingBill ? 'Edit Bill' : 'Add Bill'}
                        </h3>
                        <form onSubmit={handleSave} className="space-y-3">
                             <label htmlFor="bill-name" className="block text-sm font-bold mb-1">Bill Name</label>
                             <input 
                                id="bill-name"
                                className="w-full p-2 border rounded font-hand text-lg" 
                                placeholder="Bill Name (e.g. Rent)" 
                                required
                                value={newBill.name}
                                onChange={e => setNewBill({...newBill, name: e.target.value})}
                            />
                             <label htmlFor="bill-amount" className="block text-sm font-bold mb-1">Amount</label>
                             <input 
                                id="bill-amount"
                                className="w-full p-2 border rounded font-hand text-lg" 
                                type="number" step="0.01"
                                placeholder="Amount" 
                                required
                                value={newBill.amount}
                                onChange={e => setNewBill({...newBill, amount: e.target.value})}
                            />
                            <label htmlFor="bill-date" className="block text-sm font-bold mb-1">Due Date</label>
                            <input 
                                id="bill-date"
                                className="w-full p-2 border rounded font-hand text-lg" 
                                type="date"
                                required
                                value={newBill.date}
                                onChange={e => setNewBill({...newBill, date: e.target.value})}
                            />
                            <label htmlFor="bill-recurrence" className="block text-sm font-bold mb-1">Recurrence</label>
                            <select 
                                id="bill-recurrence"
                                className="w-full p-2 border rounded font-hand text-lg" 
                                value={newBill.recur}
                                onChange={e => setNewBill({...newBill, recur: e.target.value})}
                            >
                                <option value="weekly">Weekly</option>
                                <option value="monthly">Monthly</option>
                                <option value="yearly">Yearly</option>
                            </select>
                            
                            <div className="flex gap-2 mt-4">
                                <button type="button" onClick={() => setShowModal(false)} className="btn bg-gray-100 flex-1">Cancel</button>
                                <button type="submit" className="btn bg-red-400 text-white flex-1">
                                    {editingBill ? 'Update' : 'Save'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
