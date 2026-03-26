import Store from 'electron-store';
import bcrypt from 'bcryptjs';

const credentialStore = new Store({
  name: 'auth_credentials_v1',
  projectName: 'finance'
});

const USER_KEY = 'users';
const HASH_ROUNDS = 10;

const getUsersMap = () => {
  const raw = credentialStore.get(USER_KEY);
  if (!raw || typeof raw !== 'object') return {};
  return raw;
};

export async function saveUserCredential(userId, secret) {
  const id = String(userId || '').trim();
  const normalizedSecret = String(secret || '');
  if (!id || !normalizedSecret) {
    throw new Error('userId and secret are required.');
  }

  const hash = await bcrypt.hash(normalizedSecret, HASH_ROUNDS);
  const users = getUsersMap();
  users[id] = {
    hash,
    updatedAt: new Date().toISOString()
  };
  credentialStore.set(USER_KEY, users);
  return { ok: true };
}

export async function verifyUserCredential(userId, secret) {
  const id = String(userId || '').trim();
  const normalizedSecret = String(secret || '');
  if (!id || !normalizedSecret) return { ok: false };

  const users = getUsersMap();
  const entry = users[id];
  if (!entry?.hash) return { ok: false };

  const matches = await bcrypt.compare(normalizedSecret, entry.hash);
  return { ok: matches };
}

export function clearUserCredential(userId) {
  const id = String(userId || '').trim();
  if (!id) return { ok: false };

  const users = getUsersMap();
  if (!users[id]) return { ok: false };
  delete users[id];
  credentialStore.set(USER_KEY, users);
  return { ok: true };
}
