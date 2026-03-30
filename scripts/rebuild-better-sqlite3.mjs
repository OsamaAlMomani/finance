import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const electronPackage = require('../node_modules/electron/package.json');

const mode = process.argv[2];

if (!mode || !['node', 'electron'].includes(mode)) {
  console.error('Usage: node scripts/rebuild-better-sqlite3.mjs <node|electron>');
  process.exit(1);
}

const env = {
  ...process.env,
  npm_config_arch: process.arch
};

const clearElectronConfig = () => {
  delete env.npm_config_runtime;
  delete env.npm_config_target;
  delete env.npm_config_disturl;
};

if (mode === 'electron') {
  env.npm_config_runtime = 'electron';
  env.npm_config_target = electronPackage.version;
  env.npm_config_disturl = 'https://electronjs.org/headers';
} else {
  clearElectronConfig();
}

delete env.npm_config_build_from_source;

const child = spawn('npm rebuild better-sqlite3 --foreground-scripts', {
  cwd: process.cwd(),
  stdio: 'inherit',
  env,
  shell: true
});

child.on('exit', (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0));
});
