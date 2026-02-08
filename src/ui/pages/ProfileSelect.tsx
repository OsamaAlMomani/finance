import { useCallback, useEffect, useState } from 'react';
import { PlusCircle, UserCheck } from 'lucide-react';
import { ThemeQuickSwitch } from '../components/ThemeQuickSwitch';
import { useI18n } from '../contexts/useI18n';

interface Profile {
  id: string;
  name: string;
  created_at: string;
}

interface UserProfile {
  id: string;
  name: string;
  activeProfileId?: string;
  profiles?: Profile[];
}

export const ProfileSelectPage = ({ onSelected }: { onSelected: () => void }) => {
  const { t } = useI18n();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [newProfileName, setNewProfileName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const canUseElectron = !!window.electron?.invoke;

  const load = useCallback(async () => {
    if (!canUseElectron) {
      setError(t('profile.error.noElectron'));
      setLoading(false);
      return;
    }
    try {
      const data = await window.electron.invoke('user-get-all');
      const authUserId = localStorage.getItem('authUserId');
      const active = data.users?.find((u: UserProfile) => u.id === authUserId) || data.users?.find((u: UserProfile) => u.id === data.activeUserId);
      setUser(active || null);
      setError('');
    } catch (e) {
      console.error('Failed to load profiles', e);
      setError(t('profile.error.loadProfiles'));
    } finally {
      setLoading(false);
    }
  }, [canUseElectron, t]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreateProfile = async () => {
    if (!canUseElectron) return;
    if (!user) return;
    if (!newProfileName.trim()) {
      setError(t('profile.error.enterName'));
      return;
    }
    try {
      await window.electron.invoke('profile-create', user.id, newProfileName.trim(), null);
      setNewProfileName('');
      setError('');
      await load();
    } catch (e) {
      console.error('Create profile failed', e);
      setError(t('profile.error.createFailed'));
    }
  };

  const handleSwitchProfile = async (profileId: string) => {
    if (!canUseElectron || !user) return;
    try {
      await window.electron.invoke('profile-set-active', user.id, profileId);
      setError('');
      onSelected();
    } catch (e) {
      console.error('Switch profile failed', e);
      setError(t('profile.error.switchFailed'));
    }
  };

  if (loading) return <div>{t('profile.loading')}</div>;
  if (!user) return <div>{t('profile.noUser')}</div>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white w-full max-w-xl p-6 rounded-xl shadow border auth-card">
        <div className="auth-theme">
          <ThemeQuickSwitch />
        </div>
        <h2 className="text-3xl font-bold font-heading mb-2 text-center">{t('profile.selectTitle')}</h2>
        <p className="text-center text-sm text-gray-500 mb-6">{t('profile.userLabel', { name: user.name })}</p>

        {!!error && (
          <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700" role="alert">
            {error}
          </div>
        )}

        <div className="card mb-6">
          <h3 className="text-xl font-bold mb-3">{t('profile.createTitle')}</h3>
          <div className="flex gap-3">
            <input
              className="flex-1 p-2 border rounded"
              placeholder={t('profile.profileName')}
              value={newProfileName}
              onChange={e => setNewProfileName(e.target.value)}
            />
            <button
              onClick={handleCreateProfile}
              className="btn bg-indigo-500 text-white flex items-center gap-2"
              disabled={!canUseElectron}
            >
              <PlusCircle size={18} /> {t('profile.create')}
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {(user.profiles || []).map(p => (
            <div key={p.id} className={`card ${user.activeProfileId === p.id ? 'border-2 border-indigo-400 bg-indigo-50' : ''}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="text-lg font-bold">{p.name}</div>
                    <div className="text-xs text-gray-500">{t('common.idLabel')} {p.id}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {user.activeProfileId !== p.id && (
                    <button
                      className="btn bg-gray-100"
                      onClick={() => handleSwitchProfile(p.id)}
                      disabled={!canUseElectron}
                    >
                      {t('profile.use')}
                    </button>
                  )}
                </div>
              </div>
              {user.activeProfileId === p.id ? (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-indigo-600 font-bold">
                    <UserCheck size={18} /> {t('profile.active')}
                  </div>
                  <button
                    className="btn bg-indigo-500 text-white"
                    onClick={() => onSelected()}
                    disabled={!canUseElectron}
                  >
                    {t('profile.continue')}
                  </button>
                </div>
              ) : (
                <div />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
