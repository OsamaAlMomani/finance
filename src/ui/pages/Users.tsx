import { useEffect, useState } from 'react';
import { PlusCircle, UserCheck } from 'lucide-react';
import { useI18n } from '../contexts/useI18n';

interface User {
  id: string;
  name: string;
  created_at: string;
}

export const UsersPage = () => {
  const { t } = useI18n();
  const [users, setUsers] = useState<User[]>([]);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [newUserName, setNewUserName] = useState('');
  const [loading, setLoading] = useState(true);

  const loadUsers = async () => {
    if (!window.electron) return;
    try {
      const data = await window.electron.invoke('user-get-all');
      setUsers(data.users || []);
      setActiveUserId(data.activeUserId || null);
    } catch (e) {
      console.error('Failed to load users', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateUser = async () => {
    if (!window.electron) return;
    if (!newUserName.trim()) return;
    await window.electron.invoke('user-create', newUserName.trim());
    setNewUserName('');
    loadUsers();
  };

  const handleSwitchUser = async (id: string) => {
    if (!window.electron) return;
    await window.electron.invoke('user-set-active', id);
    window.location.reload(); // or update context
  };

  if (loading) return <div>{t('users.loading')}</div>;

  return (
    <div className="h-full flex flex-col ui-layer-stack ui-layer-scene">
      <div className="ui-layer-bg" />
      <div className="ui-layer-fx" />
      <div className="ui-layer-shadow" />
      <div className="ui-layer-content h-full flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold font-heading">{t('users.title')}</h2>
        </div>

        {/* Create new user */}
        <div className="card mb-6 ui-layer-stack ui-layer-panel">
          <div className="ui-layer-bg" />
          <div className="ui-layer-fx" />
          <div className="ui-layer-shadow" />
          <div className="ui-layer-content">
            <h3 className="text-xl font-bold mb-3">{t('users.createUser')}</h3>
            <div className="flex gap-3">
              <input
                className="flex-1 p-2 border rounded font-hand text-lg"
                placeholder={t('users.userName')}
                value={newUserName}
                onChange={e => setNewUserName(e.target.value)}
              />
              <button
                onClick={handleCreateUser}
                className="btn bg-blue-500 text-white flex items-center gap-2"
              >
                <PlusCircle size={18} /> {t('common.create')}
              </button>
            </div>
          </div>
        </div>

        {/* User list */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {users.map(u => (
            <div
              key={u.id}
              className={`card ui-layer-stack ui-layer-panel ${activeUserId === u.id ? 'border-2 border-blue-400 bg-blue-50' : ''}`}
            >
              <div className="ui-layer-bg" />
              <div className="ui-layer-fx" />
              <div className="ui-layer-shadow" />
              <div className="ui-layer-content">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-lg font-bold">{u.name}</div>
                    <div className="text-xs text-gray-500">
                      {t('common.idLabel')} {u.id}
                    </div>
                  </div>
                  {activeUserId === u.id ? (
                    <div className="flex items-center gap-2 text-blue-600 font-bold">
                      <UserCheck size={18} /> {t('users.active')}
                    </div>
                  ) : (
                    <button
                      onClick={() => handleSwitchUser(u.id)}
                      className="btn bg-gray-100"
                    >
                      {t('users.switchUser')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
