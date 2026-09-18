import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { z } from 'zod';

const ConfigSchema = z.object({
  AUTH0_DOMAIN: z.string().min(1),
  AUTH0_AUDIENCE: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  PORT: z.coerce.number().default(3001),
  SERVER_URL: z.url().default('http://localhost:3001'),
});

export type Config = z.infer<typeof ConfigSchema>;

declare module 'fastify' {
  interface FastifyInstance {
    config: Config;
  }
}

export const PLUGIN_NAME = 'config';

export interface ConfigPluginOptions {
  config: Config;
}

const configPlugin: FastifyPluginAsync<ConfigPluginOptions> = fp(
  async (fastify: FastifyInstance, options: ConfigPluginOptions) => {
    fastify.decorate('config', options.config);
  },
  { name: PLUGIN_NAME },
);

export { configPlugin };

export function parseConfig(values: unknown): Config {
  const result = ConfigSchema.safeParse(values);
  if (!result.success) throw new Error(`Invalid extension config:\n${result.error.toString()}`);
  return result.data;
}
