import { useEffect, useState } from 'react';
import { PlusCircle, LogIn } from 'lucide-react';
import { ThemeQuickSwitch } from '../components/ThemeQuickSwitch';
import { getDefaultAvatar } from '../utils/avatars';

interface UserProfile {
  id: string;
  name: string;
  created_at: string;
  avatar?: string | null;
}

export const AuthPage = ({ onLoggedIn }: { onLoggedIn: (name: string) => void }) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [activeUserId, setActiveUserId] = useState<string>('');
  const [newUserName, setNewUserName] = useState('');

  const loadUsers = async () => {
    if (!window.electron) return;
    try {
      const data = await window.electron.invoke('user-get-all');
      setUsers(data.users || []);
      if (data.users?.length) setSelectedUserId(data.users[0].id);
      if (data.activeUserId) setActiveUserId(data.activeUserId);
    } catch (e) {
      console.error('Failed to load users', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleLogin = async () => {
    if (!window.electron) return;
    if (!selectedUserId) return;
    await window.electron.invoke('user-set-active', selectedUserId);
    localStorage.setItem('authUserId', selectedUserId);
    const user = users.find(u => u.id === selectedUserId);
    onLoggedIn(user?.name || 'User');
  };

  const loginAs = async (userId: string) => {
    if (!window.electron) return;
    await window.electron.invoke('user-set-active', userId);
    localStorage.setItem('authUserId', userId);
    const user = users.find(u => u.id === userId);
    onLoggedIn(user?.name || 'User');
  };

  const handleSignup = async () => {
    if (!window.electron) return;
    if (!newUserName.trim()) return;
    const data = await window.electron.invoke('user-create', newUserName.trim(), getDefaultAvatar());
    const newUser = data.users?.[data.users.length - 1];
    if (newUser?.id) {
      await window.electron.invoke('user-set-active', newUser.id);
      localStorage.setItem('authUserId', newUser.id);
      onLoggedIn(newUser.name || 'User');
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white w-full max-w-lg p-6 rounded-xl shadow border auth-card">
        <div className="auth-theme">
          <ThemeQuickSwitch />
        </div>
        <h2 className="text-3xl font-bold font-heading mb-6 text-center">Welcome</h2>

        {!!activeUserId && (
          <div className="mb-6">
            <h3 className="text-xl font-bold mb-2">Continue</h3>
            <button
              className="btn bg-indigo-500 text-white w-full flex items-center justify-center gap-2"
              onClick={() => loginAs(activeUserId)}
            >
              <LogIn size={18} /> Continue as {users.find(u => u.id === activeUserId)?.name || 'User'}
            </button>
          </div>
        )}

        <div className="mb-6">
          <h3 className="text-xl font-bold mb-2">Login</h3>
          <div className="flex gap-3">
            <label htmlFor="login-user" className="sr-only">Select user</label>
            <select
              id="login-user"
              className="flex-1 p-2 border rounded"
              value={selectedUserId}
              onChange={e => setSelectedUserId(e.target.value)}
              title="Select user"
            >
              <option value="" disabled>Select user</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
            <button className="btn bg-blue-500 text-white flex items-center gap-2" onClick={handleLogin}>
              <LogIn size={18} /> Login
            </button>
          </div>
        </div>

        <div>
          <h3 className="text-xl font-bold mb-2">Sign Up</h3>
          <div className="flex gap-3">
            <input
              className="flex-1 p-2 border rounded"
              placeholder="New user name"
              value={newUserName}
              onChange={e => setNewUserName(e.target.value)}
            />
            <button className="btn bg-green-500 text-white flex items-center gap-2" onClick={handleSignup}>
              <PlusCircle size={18} /> Create
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
