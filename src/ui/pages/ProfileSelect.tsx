import { useEffect, useState } from 'react';
import { PlusCircle, UserCheck } from 'lucide-react';
import { ThemeQuickSwitch } from '../components/ThemeQuickSwitch';

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
  const [user, setUser] = useState<UserProfile | null>(null);
  const [newProfileName, setNewProfileName] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!window.electron) return;
    try {
      const data = await window.electron.invoke('user-get-all');
      const authUserId = localStorage.getItem('authUserId');
      const active = data.users?.find((u: UserProfile) => u.id === authUserId) || data.users?.find((u: UserProfile) => u.id === data.activeUserId);
      setUser(active || null);
    } catch (e) {
      console.error('Failed to load profiles', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreateProfile = async () => {
    if (!window.electron) return;
    if (!user) return;
    if (!newProfileName.trim()) return;
    await window.electron.invoke('profile-create', user.id, newProfileName.trim(), null);
    setNewProfileName('');
    await load();
  };

  const handleSwitchProfile = async (profileId: string) => {
    if (!window.electron || !user) return;
    await window.electron.invoke('profile-set-active', user.id, profileId);
    onSelected();
  };


  if (loading) return <div>Loading...</div>;
  if (!user) return <div>No user found.</div>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white w-full max-w-xl p-6 rounded-xl shadow border auth-card">
        <div className="auth-theme">
          <ThemeQuickSwitch />
        </div>
        <h2 className="text-3xl font-bold font-heading mb-2 text-center">Select Profile</h2>
        <p className="text-center text-sm text-gray-500 mb-6">User: {user.name}</p>

        <div className="card mb-6">
          <h3 className="text-xl font-bold mb-3">Create New Profile</h3>
          <div className="flex gap-3">
            <input
              className="flex-1 p-2 border rounded"
              placeholder="Profile name"
              value={newProfileName}
              onChange={e => setNewProfileName(e.target.value)}
            />
            <button
              onClick={handleCreateProfile}
              className="btn bg-indigo-500 text-white flex items-center gap-2"
            >
              <PlusCircle size={18} /> Create
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
                    <div className="text-xs text-gray-500">ID: {p.id}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {user.activeProfileId !== p.id && (
                    <button className="btn bg-gray-100" onClick={() => handleSwitchProfile(p.id)}>
                      Use
                    </button>
                  )}
                </div>
              </div>
              {user.activeProfileId === p.id ? (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-indigo-600 font-bold">
                    <UserCheck size={18} /> Active
                  </div>
                  <button className="btn bg-indigo-500 text-white" onClick={() => onSelected()}>
                    Continue
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
