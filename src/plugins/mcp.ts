import { toNodeHandler } from '@modelcontextprotocol/node';
import type { McpHttpHandler } from '@modelcontextprotocol/server';
import type { FastifyPluginAsync } from 'fastify';

import { buildAuthInfo, buildRequestContext, requestContext } from '../server/context.ts';
import type { RequestUser } from '../server/index.ts';

export default function createMcpPlugin(handler: McpHttpHandler): FastifyPluginAsync {
  return async function mcpPlugin(fastify) {
    const nodeHandler = toNodeHandler(handler);

    fastify.addHook('preHandler', fastify.requireAuth());

    fastify.all('/mcp', async (req, reply) => {
      // requireAuth preHandler guarantees user and token are set.
      const user = req.user as RequestUser;
      const token = req.getToken() as string;
      req.raw.auth = buildAuthInfo(user, token);
      await requestContext.run(
        buildRequestContext(user, token, fastify.config.SERVER_URL),
        () => nodeHandler(req.raw, reply.raw, req.body as unknown),
      );
    });
  };
}
