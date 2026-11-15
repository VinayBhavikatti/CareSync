import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import dotenv from 'dotenv';

dotenv.config();
if (process.env.NODE_ENV === 'production') {
  throw new Error('demo:reset is disabled when NODE_ENV=production.');
}

const serverDir = process.cwd();
const prismaCli = resolve(serverDir, '../node_modules/prisma/build/index.js');
const tsxCli = resolve(serverDir, '../node_modules/tsx/dist/cli.mjs');

console.warn('WARNING: demo:reset clears all data in the configured database.');
execFileSync(process.execPath, [prismaCli, 'db', 'push', '--force-reset'], { cwd: serverDir, stdio: 'inherit' });
execFileSync(process.execPath, [tsxCli, 'prisma/seed.ts'], { cwd: serverDir, stdio: 'inherit' });
execFileSync(process.execPath, [tsxCli, 'prisma/seed-history.ts'], { cwd: serverDir, stdio: 'inherit' });
