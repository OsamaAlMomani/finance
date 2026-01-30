import { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Target, Plus, Trash2 } from 'lucide-react';

interface Goal {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date: string;
}

export const GoalsPage = () => {
    const [goals, setGoals] = useState<Goal[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [newGoal, setNewGoal] = useState({
        name: '',
        target: '',
        date: '',
        current: '0'
    });

    const loadGoals = () => {
        if(window.electron) {
            window.electron.invoke('db-get-goals').then(setGoals);
        }
    };

    useEffect(() => {
        loadGoals();
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!window.electron) return;
        
        await window.electron.invoke('db-save-goal', {
            id: uuidv4(),
            name: newGoal.name,
            target_amount: parseFloat(newGoal.target),
            target_date: newGoal.date,
            current_amount: parseFloat(newGoal.current),
            linked_account_id: null // future feature
        });
        setShowModal(false);
        loadGoals();
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this goal?")) return;
        if (!window.electron) return;
        await window.electron.invoke('db-delete-goal', id);
        loadGoals();
    };

    return (
        <div className="h-full">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold font-heading">Financial Goals</h2>
                <button onClick={() => setShowModal(true)} className="btn bg-purple-500 text-white flex items-center gap-2">
                    <Plus size={20} /> Add Goal
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {goals.map(g => {
                    const percent = Math.min((g.current_amount / g.target_amount) * 100, 100);
                    return (
                        <div key={g.id} className="card border-t-8 border-purple-400 group relative">
                             <button 
                                onClick={() => handleDelete(g.id)}
                                className="absolute top-2 right-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                          aria-label={`Delete goal ${g.name}`}
                                          title={`Delete goal ${g.name}`}
                             >
                                <Trash2 size={16} />
                             </button>

                             <div className="flex justify-between mb-2">
                                <h3 className="font-bold text-xl">{g.name}</h3>
                                <Target className="text-purple-400" />
                             </div>
                             
                             <div className="flex justify-between text-sm text-gray-500 mb-4">
                                <span>Target: {new Date(g.target_date).toLocaleDateString()}</span>
                                <span className={percent >= 100 ? 'text-green-500 font-bold' : ''}>
                                    {percent.toFixed(0)}%
                                </span>
                             </div>

                                                         <progress
                                                             className="progress-bar category-color--purple-500 mb-4"
                                                             value={percent}
                                                             max={100}
                                                         />

                             <div className="flex justify-between items-end">
                                <div>
                                    <p className="text-xs text-gray-400">Current</p>
                                    <p className="font-bold text-lg">${g.current_amount}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-gray-400">Target</p>
                                    <p className="font-bold text-gray-600">${g.target_amount}</p>
                                </div>
                             </div>
                        </div>
                    );
                })}
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-sm">
                        <h3 className="text-2xl font-bold mb-4 font-heading">Set a Goal</h3>
                        <form onSubmit={handleSave} className="space-y-3">
                            <label htmlFor="goal-name" className="block text-sm font-bold mb-1">Goal Name</label>
                            <input 
                                id="goal-name"
                                className="w-full p-2 border rounded font-hand text-lg" 
                                placeholder="Goal Name (e.g. New Car)" 
                                required
                                value={newGoal.name}
                                onChange={e => setNewGoal({...newGoal, name: e.target.value})}
                            />
                             <label htmlFor="goal-target" className="block text-sm font-bold mb-1">Target Amount</label>
                             <input 
                                id="goal-target"
                                className="w-full p-2 border rounded font-hand text-lg" 
                                type="number" 
                                placeholder="Target Amount" 
                                required
                                value={newGoal.target}
                                onChange={e => setNewGoal({...newGoal, target: e.target.value})}
                            />
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label htmlFor="goal-date" className="text-xs font-bold text-gray-500">Target Date</label>
                                    <input 
                                        id="goal-date"
                                        className="w-full p-2 border rounded font-hand text-lg" 
                                        type="date" 
                                        required
                                        value={newGoal.date}
                                        onChange={e => setNewGoal({...newGoal, date: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label htmlFor="goal-start" className="text-xs font-bold text-gray-500">Start With</label>
                                    <input 
                                        id="goal-start"
                                        className="w-full p-2 border rounded font-hand text-lg" 
                                        type="number" 
                                        placeholder="0" 
                                        value={newGoal.current}
                                        onChange={e => setNewGoal({...newGoal, current: e.target.value})}
                                    />
                                </div>
                            </div>
                            <div className="flex gap-2 mt-4">
                                <button type="button" onClick={() => setShowModal(false)} className="btn bg-gray-100 flex-1">Cancel</button>
                                <button type="submit" className="btn bg-purple-500 text-white flex-1">Create</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
