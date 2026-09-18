import { toNodeHandler } from '@modelcontextprotocol/node';
import type { McpHttpHandler } from '@modelcontextprotocol/server';
import type { FastifyPluginAsync } from 'fastify';

import { errorDiagnostics, mcpRequestDiagnostics, requestPath } from '../diagnostics.ts';
import { buildAuthInfo, buildRequestContext, requestContext } from '../server/context.ts';
import type { RequestUser } from '../server/index.ts';

export default function createMcpPlugin(handler: McpHttpHandler): FastifyPluginAsync {
  return async function mcpPlugin(fastify) {
    const nodeHandler = toNodeHandler(handler);
    fastify.decorateRequest('mcpDiagnostics', undefined);

    fastify.addHook('preValidation', async (req) => {
      const diagnostics = mcpRequestDiagnostics(req.body);
      req.mcpDiagnostics = diagnostics;
      fastify.log.info(
        { event: 'mcp.request.received', path: requestPath(req.url), requestId: req.id, ...diagnostics },
        'MCP request received',
      );
    });

    fastify.addHook('onResponse', async (req, reply) => {
      if (!req.mcpDiagnostics) return;
      fastify.log.info(
        {
          event: 'mcp.response.completed',
          requestId: req.id,
          statusCode: reply.statusCode,
          path: requestPath(req.url),
          ...req.mcpDiagnostics,
        },
        'MCP response completed',
      );
    });

    fastify.addHook('preHandler', fastify.requireAuth());

    fastify.all('/mcp', async (req, reply) => {
      // requireAuth preHandler guarantees user and token are set.
      const user = req.user as RequestUser;
      const token = req.getToken() as string;
      const diagnostics = req.mcpDiagnostics ?? mcpRequestDiagnostics(req.body);
      req.raw.auth = buildAuthInfo(user, token);
      try {
        await requestContext.run(
          buildRequestContext(user, token, fastify.config.SERVER_URL, {
            logger: fastify.log,
            requestId: req.id,
            ...diagnostics,
          }),
          () => nodeHandler(req.raw, reply.raw, req.body as unknown),
        );
      } catch (error) {
        fastify.log.error(
          {
            event: 'mcp.handler.failed',
            ...errorDiagnostics(error),
            requestId: req.id,
            ...diagnostics,
          },
          'MCP protocol handler failed',
        );
        throw error;
      }
    });
  };
}

declare module 'fastify' {
  interface FastifyRequest {
    mcpDiagnostics?: ReturnType<typeof mcpRequestDiagnostics>;
  }
}
