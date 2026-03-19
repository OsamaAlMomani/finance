import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { switchDatabase } from '../src/services/databaseService.js';
import { registerIpcHandlers } from '../src/electron/ipcHandlers.js';

process.env.NODE_ENV = 'test';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'finance-smoke-ipc-'));
const dbPath = path.join(tempDir, 'smoke.db');

switchDatabase(dbPath);

const handlers = new Map();
const fakeIpcMain = {
  handle(channel, handler) {
    handlers.set(channel, handler);
  }
};

registerIpcHandlers(fakeIpcMain);

const requiredChannels = [
  'db-get-accounts',
  'db-get-transactions',
  'db-get-alerts',
  'db-get-system-state',
  'db-get-settlements',
  'db-get-reports',
  'db-get-scenarios',
  'db-get-permissions',
  'db-list-share-snapshots',
  'db-get-schema-status',
  'db-reset-all'
];

for (const channel of requiredChannels) {
  assert(handlers.has(channel), `Missing required IPC channel: ${channel}`);
}

const invoke = async (channel, ...args) => {
  const handler = handlers.get(channel);
  assert(handler, `Handler not registered for ${channel}`);
  return handler({}, ...args);
};

await invoke('db-get-schema-status');
await invoke('db-get-accounts');
await invoke('db-get-transactions', {});
await invoke('db-get-alerts', {});
await invoke('db-get-system-state', new Date().toISOString().slice(0, 7));
await invoke('db-get-reports');
await invoke('db-get-permissions');
await invoke('db-list-share-snapshots', {});

console.log(`[SMOKE] IPC handlers registered: ${handlers.size}`);
console.log('[SMOKE] Main-process DB + IPC smoke checks passed.');
