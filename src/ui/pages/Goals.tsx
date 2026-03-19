import { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Target, Plus, Trash2, Edit2, TrendingUp } from 'lucide-react';
import { useI18n } from '../contexts/useI18n';

interface Goal {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date: string;
  goal_type?: 'standard' | 'mission_capital';
  priority?: 'low' | 'medium' | 'high';
  funding_source?: string;
  risk_status?: string;
}

interface GoalContribution {
  id: string;
  goal_id: string;
  amount: number;
  date: string;
  source_type: string;
  notes?: string;
}

export const GoalsPage = () => {
    const { t } = useI18n();
    const [goals, setGoals] = useState<Goal[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
    const [showProgressModal, setShowProgressModal] = useState(false);
    const [progressGoal, setProgressGoal] = useState<Goal | null>(null);
    const [progressAmount, setProgressAmount] = useState('');
    const [contributions, setContributions] = useState<GoalContribution[]>([]);
    const [newGoal, setNewGoal] = useState({
        name: '',
        target: '',
        date: '',
        current: '0',
        goal_type: 'standard',
        priority: 'medium',
        funding_source: '',
        risk_status: 'normal'
    });

    const loadGoals = () => {
        if(window.electron) {
            Promise.all([
              window.electron.invoke('db-get-goals'),
              window.electron.invoke('db-get-goal-contributions').catch(() => [])
            ]).then(([goalsData, contributionsData]) => {
              setGoals(goalsData);
              setContributions(Array.isArray(contributionsData) ? contributionsData : []);
            });
        }
    };

    useEffect(() => {
        loadGoals();
    }, []);

    useEffect(() => {
        const onChanged = () => loadGoals();
        window.addEventListener('finance:data-changed', onChanged);
        return () => window.removeEventListener('finance:data-changed', onChanged);
    }, []);

    const handleOpenModal = (goal?: Goal) => {
        if (goal) {
            setEditingGoal(goal);
            setNewGoal({
                name: goal.name,
                target: goal.target_amount.toString(),
                date: goal.target_date,
                current: goal.current_amount.toString(),
                goal_type: goal.goal_type || 'standard',
                priority: goal.priority || 'medium',
                funding_source: goal.funding_source || '',
                risk_status: goal.risk_status || 'normal'
            });
        } else {
            setEditingGoal(null);
            setNewGoal({ name: '', target: '', date: '', current: '0', goal_type: 'standard', priority: 'medium', funding_source: '', risk_status: 'normal' });
        }
        setShowModal(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!window.electron) return;
        
        if (editingGoal) {
            // Update existing goal
            await window.electron.invoke('db-update-goal', {
                id: editingGoal.id,
                name: newGoal.name,
                target_amount: parseFloat(newGoal.target),
                target_date: newGoal.date,
                current_amount: parseFloat(newGoal.current),
                linked_account_id: null,
                goal_type: newGoal.goal_type,
                priority: newGoal.priority,
                funding_source: newGoal.funding_source || null,
                risk_status: newGoal.risk_status
            });
        } else {
            // Create new goal
            await window.electron.invoke('db-save-goal', {
                id: uuidv4(),
                name: newGoal.name,
                target_amount: parseFloat(newGoal.target),
                target_date: newGoal.date,
                current_amount: parseFloat(newGoal.current),
                linked_account_id: null,
                goal_type: newGoal.goal_type,
                priority: newGoal.priority,
                funding_source: newGoal.funding_source || null,
                risk_status: newGoal.risk_status
            });
        }
        setShowModal(false);
        window.dispatchEvent(new CustomEvent('finance:data-changed'));
        loadGoals();
    };

    const handleOpenProgressModal = (goal: Goal) => {
        setProgressGoal(goal);
        setProgressAmount('');
        setShowProgressModal(true);
    };

    const handleUpdateProgress = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!window.electron || !progressGoal) return;

        const newAmount = progressGoal.current_amount + parseFloat(progressAmount);
        await window.electron.invoke('db-update-goal', {
            id: progressGoal.id,
            name: progressGoal.name,
            target_amount: progressGoal.target_amount,
            target_date: progressGoal.target_date,
            current_amount: newAmount,
            linked_account_id: null,
            goal_type: progressGoal.goal_type || 'standard',
            priority: progressGoal.priority || 'medium',
            funding_source: progressGoal.funding_source || null,
            risk_status: progressGoal.risk_status || 'normal'
        });
        setShowProgressModal(false);
        window.dispatchEvent(new CustomEvent('finance:data-changed'));
        loadGoals();
    };

    const handleDelete = async (id: string) => {
        if (!confirm(t('goals.deleteConfirm'))) return;
        if (!window.electron) return;
        await window.electron.invoke('db-delete-goal', id);
        window.dispatchEvent(new CustomEvent('finance:data-changed'));
        loadGoals();
    };

    return (
        <div className="h-full flex flex-col overflow-hidden">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold font-heading">{t('goals.title')}</h2>
                <button onClick={() => handleOpenModal()} className="btn bg-purple-500 text-white flex items-center gap-2">
                    <Plus size={20} /> {t('goals.add')}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 flex-1 min-h-0 overflow-y-auto pr-1">
                {goals.map(g => {
                    const percent = Math.min((g.current_amount / g.target_amount) * 100, 100);
                    const goalContribs = contributions.filter((entry) => entry.goal_id === g.id).slice(0, 3);
                    return (
                        <div key={g.id} className="card border-t-8 border-purple-400 group relative">
                             <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                    onClick={() => handleOpenModal(g)}
                                    className="text-gray-300 hover:text-blue-500"
                                    aria-label={`${t('common.edit')} ${g.name}`}
                                    title={t('common.edit')}
                                >
                                    <Edit2 size={16} />
                                </button>
                                <button 
                                    onClick={() => handleDelete(g.id)}
                                    className="text-gray-300 hover:text-red-500"
                                    aria-label={`${t('common.delete')} ${g.name}`}
                                    title={t('common.delete')}
                                >
                                    <Trash2 size={16} />
                                </button>
                             </div>

                             <div className="flex justify-between mb-2">
                                <h3 className="font-bold text-xl">{g.name}</h3>
                                <Target className="text-purple-400" />
                             </div>
                             
                             <div className="flex justify-between text-sm text-gray-500 mb-4">
                                          <span>{t('goals.targetDate', { date: new Date(g.target_date).toLocaleDateString() })}</span>
                                <span className={percent >= 100 ? 'text-green-500 font-bold' : ''}>
                                    {percent.toFixed(0)}%
                                </span>
                             </div>

                             <div className="text-xs text-gray-500 mb-2">
                                <span className="font-semibold">Type:</span> {g.goal_type || 'standard'} | <span className="font-semibold">Priority:</span> {g.priority || 'medium'}
                                <br />
                                <span className="font-semibold">Funding:</span> {g.funding_source || 'manual'} | <span className="font-semibold">Risk:</span> {g.risk_status || 'normal'}
                             </div>

                             <progress
                                 className="progress-bar category-color--purple-500 mb-4"
                                 value={percent}
                                 max={100}
                             />

                             <div className="flex justify-between items-end mb-3">
                                <div>
                                    <p className="text-xs text-gray-400">{t('goals.current')}</p>
                                    <p className="font-bold text-lg">${g.current_amount}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-gray-400">{t('goals.target')}</p>
                                    <p className="font-bold text-gray-600">${g.target_amount}</p>
                                </div>
                             </div>

                             <button
                                onClick={() => handleOpenProgressModal(g)}
                                className="w-full btn btn-sm bg-purple-100 text-purple-600 flex items-center justify-center gap-2"
                             >
                                          <TrendingUp size={16} /> {t('goals.addProgress')}
                             </button>

                             <div className="mt-3 text-xs text-gray-600">
                                <p className="font-bold">Recent contributions</p>
                                <ul className="list-disc ml-4">
                                  {goalContribs.map((entry) => (
                                    <li key={entry.id}>{Number(entry.amount).toFixed(2)} on {entry.date}</li>
                                  ))}
                                  {goalContribs.length === 0 && <li>No contributions yet</li>}
                                </ul>
                             </div>
                        </div>
                    );
                })}
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-sm">
                        <h3 className="text-2xl font-bold mb-4 font-heading">
                            {editingGoal ? t('goals.edit') : t('goals.set')}
                        </h3>
                        <form onSubmit={handleSave} className="space-y-3">
                            <label htmlFor="goal-name" className="block text-sm font-bold mb-1">{t('goals.goalName')}</label>
                            <input 
                                id="goal-name"
                                className="w-full p-2 border rounded font-hand text-lg" 
                                placeholder={t('goals.goalNamePlaceholder')}
                                required
                                value={newGoal.name}
                                onChange={e => setNewGoal({...newGoal, name: e.target.value})}
                            />
                             <label htmlFor="goal-target" className="block text-sm font-bold mb-1">{t('goals.targetAmount')}</label>
                             <input 
                                id="goal-target"
                                className="w-full p-2 border rounded font-hand text-lg" 
                                type="number" 
                                step="0.01"
                                placeholder={t('goals.targetAmountPlaceholder')}
                                required
                                value={newGoal.target}
                                onChange={e => setNewGoal({...newGoal, target: e.target.value})}
                            />
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label htmlFor="goal-date" className="text-xs font-bold text-gray-500">{t('goals.targetDateLabel')}</label>
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
                                    <label htmlFor="goal-start" className="text-xs font-bold text-gray-500">{t('goals.currentAmountLabel')}</label>
                                    <input 
                                        id="goal-start"
                                        className="w-full p-2 border rounded font-hand text-lg" 
                                        type="number"
                                        step="0.01" 
                                        placeholder={t('goals.currentAmountPlaceholder')}
                                        value={newGoal.current}
                                        onChange={e => setNewGoal({...newGoal, current: e.target.value})}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label htmlFor="goal-type" className="text-xs font-bold text-gray-500">Goal Type</label>
                                    <select
                                        id="goal-type"
                                        className="w-full p-2 border rounded font-hand text-lg"
                                        value={newGoal.goal_type}
                                        onChange={e => setNewGoal({ ...newGoal, goal_type: e.target.value })}
                                    >
                                        <option value="standard">standard</option>
                                        <option value="mission_capital">mission_capital</option>
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="goal-priority" className="text-xs font-bold text-gray-500">Priority</label>
                                    <select
                                        id="goal-priority"
                                        className="w-full p-2 border rounded font-hand text-lg"
                                        value={newGoal.priority}
                                        onChange={e => setNewGoal({ ...newGoal, priority: e.target.value })}
                                    >
                                        <option value="low">low</option>
                                        <option value="medium">medium</option>
                                        <option value="high">high</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label htmlFor="goal-funding" className="text-xs font-bold text-gray-500">Funding Source</label>
                                    <input
                                        id="goal-funding"
                                        className="w-full p-2 border rounded font-hand text-lg"
                                        placeholder="salary / transfer / surplus"
                                        value={newGoal.funding_source}
                                        onChange={e => setNewGoal({ ...newGoal, funding_source: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label htmlFor="goal-risk" className="text-xs font-bold text-gray-500">Risk Status</label>
                                    <select
                                        id="goal-risk"
                                        className="w-full p-2 border rounded font-hand text-lg"
                                        value={newGoal.risk_status}
                                        onChange={e => setNewGoal({ ...newGoal, risk_status: e.target.value })}
                                    >
                                        <option value="normal">normal</option>
                                        <option value="watch">watch</option>
                                        <option value="at_risk">at_risk</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex gap-2 mt-4">
                                <button type="button" onClick={() => setShowModal(false)} className="btn bg-gray-100 flex-1">{t('common.cancel')}</button>
                                <button type="submit" className="btn bg-purple-500 text-white flex-1">
                                    {editingGoal ? t('common.update') : t('common.create')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showProgressModal && progressGoal && (
                <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-sm">
                        <h3 className="text-2xl font-bold mb-4 font-heading">{t('goals.updateProgress')}</h3>
                        <p className="text-gray-600 mb-4">{t('goals.goalLabel', { name: progressGoal.name })}</p>
                        <p className="text-sm text-gray-500 mb-4">
                            {t('goals.currentSummary', { current: progressGoal.current_amount, target: progressGoal.target_amount })}
                        </p>
                        <form onSubmit={handleUpdateProgress} className="space-y-4">
                            <div>
                                <label htmlFor="progress-amount" className="block text-sm font-bold mb-1">
                                    {t('goals.addAmount')}
                                </label>
                                <input
                                    id="progress-amount"
                                    className="w-full p-2 border rounded font-hand text-lg"
                                    type="number"
                                    step="0.01"
                                    placeholder={t('goals.addAmountPlaceholder')}
                                    required
                                    value={progressAmount}
                                    onChange={e => setProgressAmount(e.target.value)}
                                />
                                {progressAmount && (
                                    <p className="text-xs text-gray-500 mt-1">
                                        {t('goals.newTotal', { amount: (progressGoal.current_amount + parseFloat(progressAmount || '0')).toFixed(2) })}
                                    </p>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowProgressModal(false)}
                                    className="btn bg-gray-100 flex-1"
                                >
                                    {t('common.cancel')}
                                </button>
                                <button type="submit" className="btn bg-purple-500 text-white flex-1">
                                    {t('common.update')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
