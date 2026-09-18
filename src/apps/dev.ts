import { readdir, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { RollupWatcher } from 'rollup';
import { build, mergeConfig } from 'vite';

import base from './vite.config.base.ts';

const EXCLUDED_DIRS = new Set(['dist', 'node_modules']);

async function hasEntrypoint(dir: string): Promise<boolean> {
  try {
    await access(join(dir, 'mcp-app.html'));
    return true;
  } catch {
    return false;
  }
}

const appsRoot = dirname(fileURLToPath(import.meta.url));
const distRoot = join(appsRoot, 'dist');

const entries = await readdir(appsRoot, { withFileTypes: true });
const appNames = (
  await Promise.all(
    entries
      .filter((e) => e.isDirectory() && !e.name.startsWith('_') && !EXCLUDED_DIRS.has(e.name))
      .map(async (e) => ((await hasEntrypoint(join(appsRoot, e.name))) ? e.name : null)),
  )
).filter((name): name is string => name !== null);

if (appNames.length === 0) {
  console.error('No apps found. Create a directory with an mcp-app.html inside src/apps/.');
  process.exit(1);
}

console.log(`Watching ${appNames.length} app(s): ${appNames.join(', ')}`);

const watchers = await Promise.all(
  appNames.map((appName) => {
    const appDir = join(appsRoot, appName);
    return build(
      mergeConfig(base, {
        root: appDir,
        configFile: false,
        build: {
          outDir: join(distRoot, appName),
          rollupOptions: { input: join(appDir, 'mcp-app.html') },
          watch: {},
        },
      }),
    ) as Promise<RollupWatcher>;
  }),
);

async function cleanup() {
  await Promise.all(watchers.map((w) => w.close()));
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
