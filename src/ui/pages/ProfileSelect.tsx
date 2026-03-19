import { useCallback, useEffect, useState } from 'react';
import { FlaskConical, PlusCircle, UserCheck, User, Sparkles, ChevronDown, X } from 'lucide-react';
import { ThemeQuickSwitch } from '../components/ThemeQuickSwitch';
import { useI18n } from '../contexts/useI18n';

// ---------- Types ----------
interface Profile {
  id: string;
  name: string;
  created_at: string;
  isLab?: boolean;
}

interface UserProfile {
  id: string;
  name: string;
  activeProfileId?: string;
  profiles?: Profile[];
}

// ---------- Custom Hook for Profile Management ----------
const useProfileManager = () => {
  const { t } = useI18n();
  const [user, setUser] = useState<UserProfile | null>(null);
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

  const createProfile = async (name: string, isLab = false) => {
    if (!canUseElectron || !user) return false;
    try {
      await window.electron.invoke('profile-create', user.id, name, null, isLab ? { isLab: true } : undefined);
      await load();
      return true;
    } catch (e) {
      console.error('Create profile failed', e);
      setError(t('profile.error.createFailed'));
      return false;
    }
  };

  const switchProfile = async (profileId: string) => {
    if (!canUseElectron || !user) return false;
    try {
      await window.electron.invoke('profile-set-active', user.id, profileId);
      setError('');
      return true;
    } catch (e) {
      console.error('Switch profile failed', e);
      setError(t('profile.error.switchFailed'));
      return false;
    }
  };

  useEffect(() => {
    load();
  }, [load]);

  return {
    user,
    loading,
    error,
    setError,
    createProfile,
    switchProfile,
    refresh: load,
    canUseElectron,
  };
};

// ---------- Normal View (full page) ----------
const NormalView = ({
  user,
  onSwitch,
  onCreate,
  onContinue,
  error,
  setError,
  canUseElectron,
}: {
  user: UserProfile;
  onSwitch: (id: string) => Promise<boolean>;
  onCreate: (name: string, isLab?: boolean) => Promise<boolean>;
  onContinue: () => void;
  error: string;
  setError: (err: string) => void;
  canUseElectron: boolean;
}) => {
  const { t } = useI18n();
  const [newProfileName, setNewProfileName] = useState('');
  const hasLabProfile = user.profiles?.some(p => p.isLab) ?? false;

  const handleCreateProfile = async () => {
    const trimmed = newProfileName.trim();
    if (!trimmed) {
      setError(t('profile.error.enterName'));
      return;
    }
    const success = await onCreate(trimmed);
    if (success) setNewProfileName('');
  };

  const handleCreateLabProfile = async () => {
    await onCreate(t('profile.labName'), true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-theme-surface p-4 ui-layer-stack ui-layer-scene">
      <div className="ui-layer-bg" />
      <div className="ui-layer-fx" />
      <div className="ui-layer-shadow" />
      <div className="w-full max-w-3xl ui-layer-content">
        {/* Header with theme switcher */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-heading font-bold text-ink">{t('profile.selectTitle')}</h1>
          <ThemeQuickSwitch />
        </div>

        {/* User greeting */}
        <p className="text-muted mb-8 flex items-center gap-2">
          <Sparkles size={20} />
          {t('profile.userLabel', { name: user.name })}
        </p>

        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 rounded-lg border border-theme-error bg-theme-error-soft text-theme-error text-sm">
            {error}
          </div>
        )}

        {/* Create new profile card */}
        <div className="card mb-8 ui-layer-stack ui-layer-panel">
          <div className="ui-layer-bg" />
          <div className="ui-layer-fx" />
          <div className="ui-layer-shadow" />
          <div className="ui-layer-content">
            <h2 className="text-xl font-bold mb-4 text-ink">{t('profile.createTitle')}</h2>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                className="flex-1 p-3 border-theme rounded bg-theme-surface text-ink placeholder:text-muted"
                placeholder={t('profile.profileName')}
                value={newProfileName}
                onChange={e => setNewProfileName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreateProfile()}
              />
              <button
                onClick={handleCreateProfile}
                className="btn btn-secondary flex items-center justify-center gap-2"
                disabled={!canUseElectron}
              >
                <PlusCircle size={18} /> {t('profile.create')}
              </button>
            </div>

            {!hasLabProfile ? (
              <button
                onClick={handleCreateLabProfile}
                className="mt-4 w-full btn bg-theme-accent text-ink flex items-center justify-center gap-2 hover:bg-theme-primary hover:text-white transition-colors"
                disabled={!canUseElectron}
              >
                <FlaskConical size={18} /> {t('profile.labCreate')}
              </button>
            ) : (
              <p className="mt-4 text-sm text-muted flex items-center gap-2">
                <FlaskConical size={16} /> {t('profile.labExists')}
              </p>
            )}
          </div>
        </div>

        {/* Profiles list */}
        <h2 className="text-xl font-bold mb-4 text-ink">{t('profile.yourProfiles')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {user.profiles?.map(profile => {
            const isActive = user.activeProfileId === profile.id;
            return (
              <div
                key={profile.id}
                className={`card relative overflow-hidden transition-all duration-200 hover:shadow-theme-primary ui-layer-stack ui-layer-panel ${isActive ? 'border-2 border-theme-primary bg-theme-primary-soft' : ''
                  }`}
              >
                <div className="ui-layer-bg" />
                <div className="ui-layer-fx" />
                <div className="ui-layer-shadow" />
                <div className="ui-layer-content">
                  {/* Lab badge if applicable */}
                  {profile.isLab && (
                    <div className="absolute top-3 right-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-theme-accent px-2 py-1 text-xs font-bold text-ink">
                        <FlaskConical size={12} />
                        {t('profile.labBadge')}
                      </span>
                    </div>
                  )}

                  <div className="p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-xl font-bold text-ink flex items-center gap-2">
                          {profile.name}
                          {isActive && <UserCheck size={20} className="text-theme-primary" />}
                        </h3>
                        <p className="text-xs text-muted mt-1">
                          {t('common.created')}: {new Date(profile.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex justify-end">
                      {!isActive ? (
                        <button
                          onClick={() => onSwitch(profile.id)}
                          className="btn btn-secondary text-sm py-2 px-4"
                          disabled={!canUseElectron}
                        >
                          {t('profile.use')}
                        </button>
                      ) : (
                        <button
                          onClick={onContinue}
                          className="btn bg-theme-primary text-white text-sm py-2 px-6"
                        >
                          {t('profile.continue')}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Decorative line for active profile */}
                  {isActive && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-theme-primary to-transparent" />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {(!user.profiles || user.profiles.length === 0) && (
          <div className="text-center py-12 text-muted">
            <User size={48} className="mx-auto mb-4 opacity-50" />
            <p>{t('profile.noProfiles')}</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ---------- Mini View (compact dropdown) ----------
const MiniView = ({
  user,
  onSwitch,
  onCreate,
  onOpenFull,
  canUseElectron,
}: {
  user: UserProfile;
  onSwitch: (id: string) => Promise<boolean>;
  onCreate: (name: string, isLab?: boolean) => Promise<boolean>;
  onOpenFull: () => void;
  canUseElectron: boolean;
}) => {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [error, setError] = useState('');

  const activeProfile = user.profiles?.find(p => p.id === user.activeProfileId);

  const handleCreate = async () => {
    const trimmed = newProfileName.trim();
    if (!trimmed) {
      setError(t('profile.error.enterName'));
      return;
    }
    const success = await onCreate(trimmed);
    if (success) {
      setNewProfileName('');
      setShowCreate(false);
      setError('');
      setIsOpen(false); // close dropdown after creation
    }
  };

  const handleSwitch = async (id: string) => {
    const success = await onSwitch(id);
    if (success) {
      setIsOpen(false);
    }
  };

  return (
    <div className="relative">
      {/* Dropdown trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-theme bg-theme-surface text-ink hover:bg-theme-primary-soft transition-colors"
      >
        <User size={16} />
        <span className="font-medium">{activeProfile?.name || t('profile.selectProfile')}</span>
        <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-theme-surface border border-theme rounded-lg shadow-theme z-50 overflow-hidden">
          <div className="p-2 border-b border-theme bg-theme-primary-soft">
            <p className="text-xs font-bold text-muted">{t('profile.switchProfile')}</p>
          </div>

          <div className="max-h-60 overflow-y-auto">
            {user.profiles?.map(profile => {
              const isActive = profile.id === user.activeProfileId;
              return (
                <button
                  key={profile.id}
                  onClick={() => handleSwitch(profile.id)}
                  className={`w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-theme-primary-soft transition-colors ${isActive ? 'bg-theme-primary-soft font-bold' : ''
                    }`}
                >
                  {profile.isLab && <FlaskConical size={14} className="text-theme-accent" />}
                  <span className="flex-1 truncate">{profile.name}</span>
                  {isActive && <UserCheck size={14} className="text-theme-primary" />}
                </button>
              );
            })}
          </div>

          {/* Create new profile inline */}
          {showCreate ? (
            <div className="p-2 border-t border-theme">
              <input
                autoFocus
                className="w-full p-2 mb-2 text-sm border-theme rounded bg-theme-surface text-ink"
                placeholder={t('profile.profileName')}
                value={newProfileName}
                onChange={e => setNewProfileName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
              />
              {error && <p className="text-xs text-theme-error mb-2">{error}</p>}
              <div className="flex gap-2">
                <button
                  onClick={handleCreate}
                  className="flex-1 btn btn-secondary text-xs py-1"
                  disabled={!canUseElectron}
                >
                  {t('common.save')}
                </button>
                <button
                  onClick={() => { setShowCreate(false); setNewProfileName(''); setError(''); }}
                  className="px-2 py-1 text-xs text-muted hover:text-ink"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ) : (
            <div className="p-2 border-t border-theme">
              <button
                onClick={() => setShowCreate(true)}
                className="w-full flex items-center gap-2 px-2 py-1 text-sm text-left hover:bg-theme-primary-soft rounded"
              >
                <PlusCircle size={14} />
                {t('profile.createNew')}
              </button>
              <button
                onClick={onOpenFull}
                className="w-full flex items-center gap-2 px-2 py-1 text-sm text-left hover:bg-theme-primary-soft rounded"
              >
                <Sparkles size={14} />
                {t('profile.manageFull')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ---------- Main Component ----------
interface ProfileSelectPageProps {
  onSelected: () => void;
  onOpenFull?: () => void;
  variant?: 'full' | 'mini' | 'normal';
}

export const ProfileSelectPage = ({ onSelected, onOpenFull, variant = 'full' }: ProfileSelectPageProps) => {
  const { t } = useI18n();
  const { user, loading, error, setError, createProfile, switchProfile, canUseElectron } = useProfileManager();

  const handleSwitchAndContinue = async (id: string): Promise<boolean> => {
    const success = await switchProfile(id);
    if (success) onSelected();
    return success;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-theme-surface">
        <div className="text-ink text-lg animate-pulse">{t('profile.loading')}</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-theme-surface">
        <div className="card p-8 text-center">
          <User size={48} className="mx-auto mb-4 text-muted" />
          <p className="text-ink text-lg">{t('profile.noUser')}</p>
        </div>
      </div>
    );
  }

  if (variant === 'mini') {
    return (
      <MiniView
        user={user}
        onSwitch={handleSwitchAndContinue}
        onCreate={createProfile}
        onOpenFull={onOpenFull || onSelected}
        canUseElectron={canUseElectron}
      />
    );
  }

  // Full view (default)
  return (
    <NormalView
      user={user}
      onSwitch={handleSwitchAndContinue}
      onCreate={createProfile}
      onContinue={onSelected}
      error={error}
      setError={setError}
      canUseElectron={canUseElectron}
    />
  );
};
