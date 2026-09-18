import cors from '@fastify/cors';
import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

export const PLUGIN_NAME = 'cors';

const corsPlugin: FastifyPluginAsync = fp(
  async (fastify) => {
    await fastify.register(cors, { origin: true });
  },
  { name: PLUGIN_NAME },
);

export default corsPlugin;
