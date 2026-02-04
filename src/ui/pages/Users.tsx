import { useEffect, useState } from 'react';
import { PlusCircle, UserCheck } from 'lucide-react';

interface Profile {
  id: string;
  name: string;
  created_at: string;
}

interface UserProfile {
  id: string;
  name: string;
  created_at: string;
  activeProfileId?: string;
  profiles?: Profile[];
}

export const UsersPage = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [newUserName, setNewUserName] = useState('');
  const [newProfileName, setNewProfileName] = useState('');
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

  const handleCreate = async () => {
    if (!window.electron) return;
    if (!newUserName.trim()) return;
    await window.electron.invoke('user-create', newUserName.trim());
    setNewUserName('');
    loadUsers();
  };

  const handleSwitch = async (id: string) => {
    if (!window.electron) return;
    await window.electron.invoke('user-set-active', id);
    window.location.reload();
  };

  const handleCreateProfile = async () => {
    if (!window.electron) return;
    if (!activeUserId) return;
    if (!newProfileName.trim()) return;
    await window.electron.invoke('profile-create', activeUserId, newProfileName.trim());
    setNewProfileName('');
    loadUsers();
  };

  const handleSwitchProfile = async (profileId: string) => {
    if (!window.electron) return;
    if (!activeUserId) return;
    await window.electron.invoke('profile-set-active', activeUserId, profileId);
    window.location.reload();
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold font-heading">Users</h2>
      </div>

      <div className="card mb-6">
        <h3 className="text-xl font-bold mb-3">Create New User</h3>
        <div className="flex gap-3">
          <input
            className="flex-1 p-2 border rounded font-hand text-lg"
            placeholder="User name"
            value={newUserName}
            onChange={e => setNewUserName(e.target.value)}
          />
          <button
            onClick={handleCreate}
            className="btn bg-blue-500 text-white flex items-center gap-2"
          >
            <PlusCircle size={18} /> Create
          </button>
        </div>
      </div>

      <div className="card mb-6">
        <h3 className="text-xl font-bold mb-3">Create New Profile (for active user)</h3>
        <div className="flex gap-3">
          <input
            className="flex-1 p-2 border rounded font-hand text-lg"
            placeholder="Profile name"
            value={newProfileName}
            onChange={e => setNewProfileName(e.target.value)}
          />
          <button
            onClick={handleCreateProfile}
            className="btn bg-indigo-500 text-white flex items-center gap-2"
            disabled={!activeUserId}
          >
            <PlusCircle size={18} /> Create Profile
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {users.map(u => (
          <div key={u.id} className={`card ${activeUserId === u.id ? 'border-2 border-blue-400 bg-blue-50' : ''}`}>
            <div className="flex justify-between items-center mb-3">
              <div>
                <div className="text-lg font-bold">{u.name}</div>
                <div className="text-xs text-gray-500">ID: {u.id}</div>
              </div>
              {activeUserId === u.id ? (
                <div className="flex items-center gap-2 text-blue-600 font-bold">
                  <UserCheck size={18} /> Active
                </div>
              ) : (
                <button
                  onClick={() => handleSwitch(u.id)}
                  className="btn bg-gray-100"
                >
                  Switch User
                </button>
              )}
            </div>

            {activeUserId === u.id && (
              <div>
                <div className="text-sm font-bold text-gray-600 mb-2">Profiles</div>
                <div className="space-y-2">
                  {(u.profiles || []).map(p => (
                    <div key={p.id} className="flex items-center justify-between bg-white border rounded p-2">
                      <div>
                        <div className="text-sm font-bold">{p.name}</div>
                        <div className="text-xs text-gray-400">ID: {p.id}</div>
                      </div>
                      {u.activeProfileId === p.id ? (
                        <span className="text-xs font-bold text-indigo-600">Active</span>
                      ) : (
                        <button
                          className="btn bg-gray-100"
                          onClick={() => handleSwitchProfile(p.id)}
                        >
                          Switch Profile
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
