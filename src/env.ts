import { AsyncLocalStorage } from 'node:async_hooks';

export type RuntimeConfig = (key: string) => string | undefined;

// Auth0 Extensions supply settings per Webtask invocation rather than through
// process.env. The request-scoped reader preserves the original tool helpers.
export const runtimeConfig = new AsyncLocalStorage<RuntimeConfig>();

export function requireEnv(key: string): string {
  const value = runtimeConfig.getStore()?.(key) ?? process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}
