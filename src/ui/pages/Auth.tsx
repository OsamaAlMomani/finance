import { useCallback, useEffect, useState } from 'react';
import { PlusCircle, LogIn } from 'lucide-react';
import { ThemeQuickSwitch } from '../components/ThemeQuickSwitch';
import { getDefaultAvatar } from '../utils/avatars';
import { useI18n } from '../contexts/useI18n';
import { LanguageSwitch } from '../components/LanguageSwitch';

interface UserProfile {
  id: string;
  name: string;
  created_at: string;
  avatar?: string | null;
}

export const AuthPage = ({ onLoggedIn }: { onLoggedIn: (name: string) => void }) => {
  const { t } = useI18n();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [activeUserId, setActiveUserId] = useState<string>('');
  const [newUserName, setNewUserName] = useState('');
  const [error, setError] = useState<string>('');
  const canUseElectron = !!window.electron?.invoke;

  const loadUsers = useCallback(async () => {
    if (!canUseElectron) {
      setError(t('auth.error.noElectron'));
      setLoading(false);
      return;
    }
    try {
      const data = await window.electron.invoke('user-get-all');
      setUsers(data.users || []);
      if (data.users?.length) setSelectedUserId(data.users[0].id);
      if (data.activeUserId) setActiveUserId(data.activeUserId);
      setError('');
    } catch (e) {
      console.error('Failed to load users', e);
      setError(t('auth.error.loadUsers'));
    } finally {
      setLoading(false);
    }
  }, [canUseElectron, t]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleLogin = async () => {
    if (!canUseElectron) return;
    if (!selectedUserId) {
      setError(t('auth.error.selectUser'));
      return;
    }
    try {
      await window.electron.invoke('user-set-active', selectedUserId);
      localStorage.setItem('authUserId', selectedUserId);
      const user = users.find(u => u.id === selectedUserId);
      onLoggedIn(user?.name || 'User');
      setError('');
    } catch (e) {
      console.error('Login failed', e);
      setError(t('auth.error.loginFailed'));
    }
  };

  const loginAs = async (userId: string) => {
    if (!canUseElectron) return;
    try {
      await window.electron.invoke('user-set-active', userId);
      localStorage.setItem('authUserId', userId);
      const user = users.find(u => u.id === userId);
      onLoggedIn(user?.name || 'User');
      setError('');
    } catch (e) {
      console.error('Login failed', e);
      setError(t('auth.error.loginFailed'));
    }
  };

  const handleSignup = async () => {
    if (!canUseElectron) return;
    if (!newUserName.trim()) {
      setError(t('auth.error.enterName'));
      return;
    }
    try {
      const data = await window.electron.invoke('user-create', newUserName.trim(), getDefaultAvatar());
      const newUser = data.users?.[data.users.length - 1];
      if (newUser?.id) {
        await window.electron.invoke('user-set-active', newUser.id);
        localStorage.setItem('authUserId', newUser.id);
        onLoggedIn(newUser.name || 'User');
        setError('');
      }
    } catch (e) {
      console.error('Signup failed', e);
      setError(t('auth.error.signupFailed'));
    }
  };

  if (loading) return <div>{t('auth.loading')}</div>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white w-full max-w-lg p-6 rounded-xl shadow border auth-card">
        <div className="auth-theme">
          <ThemeQuickSwitch />
        </div>
        <h2 className="text-3xl font-bold font-heading mb-4 text-center">{t('auth.welcome')}</h2>
        <div className="mb-6">
          <LanguageSwitch />
        </div>

        {!!error && (
          <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700" role="alert">
            {error}
          </div>
        )}

        {!!activeUserId && (
          <div className="mb-6">
            <h3 className="text-xl font-bold mb-2">{t('auth.continue')}</h3>
            <button
              className="btn bg-indigo-500 text-white w-full flex items-center justify-center gap-2"
              onClick={() => loginAs(activeUserId)}
              disabled={!canUseElectron}
            >
              <LogIn size={18} /> {t('auth.continueAs', { name: users.find(u => u.id === activeUserId)?.name || t('titlebar.userFallback') })}
            </button>
          </div>
        )}

        <div className="mb-6">
          <h3 className="text-xl font-bold mb-2">{t('auth.login')}</h3>
          <div className="flex gap-3">
            <label htmlFor="login-user" className="sr-only">{t('auth.selectUser')}</label>
            <select
              id="login-user"
              className="flex-1 p-2 border rounded"
              value={selectedUserId}
              onChange={e => setSelectedUserId(e.target.value)}
              title={t('auth.selectUser')}
            >
              <option value="" disabled>{t('auth.selectUser')}</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
            <button
              className="btn bg-blue-500 text-white flex items-center gap-2"
              onClick={handleLogin}
              disabled={!selectedUserId || !canUseElectron}
            >
              <LogIn size={18} /> {t('auth.login')}
            </button>
          </div>
        </div>

        <div>
          <h3 className="text-xl font-bold mb-2">{t('auth.signUp')}</h3>
          <div className="flex gap-3">
            <input
              className="flex-1 p-2 border rounded"
              placeholder={t('auth.newUserName')}
              value={newUserName}
              onChange={e => setNewUserName(e.target.value)}
            />
            <button
              className="btn bg-green-500 text-white flex items-center gap-2"
              onClick={handleSignup}
              disabled={!canUseElectron}
            >
              <PlusCircle size={18} /> {t('auth.create')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
