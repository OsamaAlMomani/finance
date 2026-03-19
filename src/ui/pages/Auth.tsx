import { useCallback, useEffect, useState } from 'react';
import { LogIn } from 'lucide-react';
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

  const handleSignup = async (name: string) => {
    if (!canUseElectron) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t('auth.error.enterName'));
      return;
    }
    try {
      const data = await window.electron.invoke('user-create', trimmed, getDefaultAvatar());
      const newUser = data.users?.[data.users.length - 1];
      if (newUser?.id) {
        await window.electron.invoke('user-set-active', newUser.id);
        localStorage.setItem('authUserId', newUser.id);
        onLoggedIn(newUser.name);
        setError('');
      }
    } catch (e) {
      console.error('Signup failed', e);
      setError(t('auth.error.signupFailed'));
    }
  };

  const promptNewUser = () => {
    const raw = prompt(t('auth.enterName') || 'Enter first name for new user:');
    if (raw !== null) handleSignup(raw);
  };

  if (loading) return <div>{t('auth.loading')}</div>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 ui-layer-stack ui-layer-scene">
      <div className="ui-layer-bg" />
      <div className="ui-layer-fx" />
      <div className="ui-layer-shadow" />
      <div className="ui-layer-content w-full flex items-center justify-center p-3">
        <div className="bg-white w-full max-w-lg p-6 rounded-xl shadow border auth-card relative ui-layer-stack ui-layer-panel">
          <div className="ui-layer-bg" />
          <div className="ui-layer-fx" />
          <div className="ui-layer-shadow" />
          <div className="ui-layer-content">
            <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
              <ThemeQuickSwitch />
              <button
                onClick={promptNewUser}
                className="text-3xl font-light leading-none text-gray-500 hover:text-indigo-600 transition-colors w-10 h-10 flex items-center justify-center rounded-full hover:bg-indigo-50"
                title={t('auth.createNew')}
                aria-label={t('auth.createNew')}
              >
                +
              </button>
            </div>

            <h2 className="text-3xl font-bold font-heading mb-4 text-center">{t('auth.welcome')}</h2>
            <div className="mb-6 flex justify-center">
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
              <h3 className="text-xl font-bold mb-3">{t('auth.chooseUser')}</h3>
              <div className="user-grid">
                {users.map(user => {
                  const isSelected = user.id === selectedUserId;
                  const initial = user.name?.trim()?.charAt(0)?.toUpperCase() || '?';
                  return (
                    <div
                      key={user.id}
                      className={`user-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => setSelectedUserId(user.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setSelectedUserId(user.id)}
                      aria-pressed={isSelected}
                    >
                      <div className="avatar-circle">
                        {initial}
                      </div>
                      <div className="user-name">{user.name}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              className="btn bg-blue-500 text-white w-full flex items-center justify-center gap-2"
              onClick={handleLogin}
              disabled={!selectedUserId || !canUseElectron}
            >
              <LogIn size={18} /> {t('auth.login')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
