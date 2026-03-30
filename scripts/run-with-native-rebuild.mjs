import { spawn } from 'node:child_process';

const command = process.argv.slice(2).join(' ').trim();

if (!command) {
  console.error('Usage: node scripts/run-with-native-rebuild.mjs "<command>"');
  process.exit(1);
}

const run = (cmd) =>
  new Promise((resolve) => {
    const child = spawn(cmd, {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: true,
      env: process.env
    });

    child.on('exit', (code, signal) => {
      resolve({ code: code ?? (signal ? 1 : 0), signal });
    });
  });

let exitCode = 0;

try {
  const main = await run(command);
  exitCode = main.code;
} finally {
  const restore = await run('npm run rebuild:electron');
  if (restore.code !== 0 && exitCode === 0) {
    exitCode = restore.code;
  }
}

process.exit(exitCode);
