import { ApiClient, BearerMethod, ProtectedResourceMetadataBuilder } from '@auth0/auth0-api-js';
import type { FastifyError, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';

import { PLUGIN_NAME as CONFIG_PLUGIN_NAME } from '../config.ts';
import { buildUser } from '../server/context.ts';
import { AuthenticationError, InsufficientScopeError, sanitizeDescription } from '../server/errors.ts';
import type { RequestUser } from '../server/index.ts';

export const PLUGIN_NAME = 'auth';

export type { RequestUser };

declare module 'fastify' {
  interface FastifyInstance {
    requireAuth: () => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    user: RequestUser | undefined;
    getToken(): string | undefined;
  }
}

function extractBearerToken(header: string | undefined): string | undefined {
  if (!header?.startsWith('Bearer ')) return undefined;
  return header.slice(7);
}

const authPlugin: FastifyPluginAsync = fp(
  async (fastify) => {
    const client = new ApiClient({
      domain: fastify.config.AUTH0_DOMAIN,
      audience: fastify.config.AUTH0_AUDIENCE,
    });

    fastify.decorateRequest<RequestUser | undefined>('user', undefined);
    fastify.decorateRequest('getToken', function(this: FastifyRequest): string | undefined {
      return extractBearerToken(this.headers.authorization);
    });

    const mcpUrl = `${fastify.config.SERVER_URL}/mcp`;
    const endpoint = new URL(mcpUrl);
    const resourceMetadataUrl = `${endpoint.origin}/.well-known/oauth-protected-resource${endpoint.pathname}`;
    const wwwAuthHeader = (error: string, description: string) =>
      `Bearer realm="mcp", resource_metadata="${resourceMetadataUrl}", error="${error}", error_description="${sanitizeDescription(description)}"`;

    fastify.setErrorHandler((err, _request, reply) => {
      if (err instanceof InsufficientScopeError) {
        return reply
          .header('WWW-Authenticate', wwwAuthHeader('insufficient_scope', err.message))
          .code(403)
          .send({ error: 'Forbidden', message: err.message });
      }
      if (err instanceof AuthenticationError) {
        return reply
          .header('WWW-Authenticate', wwwAuthHeader('invalid_token', err.message))
          .code(401)
          .send({ error: 'Unauthorized', message: err.message });
      }
      reply.code((err as FastifyError).statusCode ?? 500).send(err);
    });

    // The companion .well-known extension owns the host-root discovery path.
    // These namespaced routes remain as an extension-scoped compatibility fallback.
    const metadata = new ProtectedResourceMetadataBuilder(
      mcpUrl,
      [`https://${fastify.config.AUTH0_DOMAIN}/`],
    )
      .withBearerMethodsSupported([BearerMethod.HEADER])
      .build();

    fastify.get('/.well-known/oauth-protected-resource', async (_req, reply) => {
      reply.header('Content-Type', 'application/json').send(metadata.toJSON());
    });
    fastify.get('/.well-known/oauth-protected-resource/mcp', async (_req, reply) => {
      reply.header('Content-Type', 'application/json').send(metadata.toJSON());
    });

    fastify.decorate('requireAuth', () => async (req: FastifyRequest) => {
      const token = extractBearerToken(req.headers.authorization);
      if (!token) throw new AuthenticationError('Missing Bearer token');
      try {
        const claims = await client.verifyAccessToken({ accessToken: token });
        req.user = buildUser(claims);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Token verification failed';
        throw new AuthenticationError(errorMessage);
      }
    });
  },
  { name: PLUGIN_NAME, dependencies: [CONFIG_PLUGIN_NAME] },
);

export { authPlugin };
