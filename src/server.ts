import { McpServer, createMcpHandler } from '@modelcontextprotocol/server';
import fastifyExpress from '@fastify/express';
import Fastify from 'fastify';

import { createExtensionApp, renderExtensionPage } from './app.ts';
import { type Config, configPlugin } from './config.ts';
import travelRoutes from './mock/travel.ts';
import { authPlugin } from './plugins/auth.ts';
import corsPlugin from './plugins/cors.ts';
import createMcpPlugin from './plugins/mcp.ts';
import { registerAuth0FormsTools } from './toolkits/auth0-forms/index.ts';
import { registerBookingsTools } from './toolkits/bookings/index.ts';
import { registerHistoryTools } from './toolkits/history/index.ts';
import { registerRecommendationsTools } from './toolkits/recommendations/index.ts';

import webtaskManifest from '../webtask.json' with { type: 'json' };

type ConfigReader = (key: string) => string | undefined;

export async function buildServer(
  config: Config,
  configReader: ConfigReader,
  initialRequest?: Parameters<typeof createExtensionApp>[1],
) {
  const app = Fastify({
    logger: {
      level: 'info',
      redact: {
        paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers.set-cookie'],
        remove: true,
      },
    },
  });

  app.log.info(
    {
      auth0Domain: config.AUTH0_DOMAIN,
      audience: config.AUTH0_AUDIENCE,
      event: 'extension.initialized',
      formsSdkUrl: `https://${config.AUTH0_DOMAIN}/forms/sdk/forms.js`,
      runtime: process.version,
    },
    'MCP playground extension initialized',
  );

  await app.register(configPlugin, { config });
  await app.register(corsPlugin);
  await app.register(authPlugin);
  await app.register(fastifyExpress);

  // Auth0's dashboard-admin middleware is supplied by the reference template.
  // It is mounted only for the extension setup routes; MCP, mock APIs, and all
  // source application routes below remain Fastify routes.
  app.use(createExtensionApp(configReader, initialRequest, { setupOnly: true }));

  const mcpServer = new McpServer({ name: 'mcp-server', version: '1.0.0' });

  registerRecommendationsTools(mcpServer);
  registerHistoryTools(mcpServer);
  registerBookingsTools(mcpServer);
  registerAuth0FormsTools(mcpServer);

  const mcpHandler = createMcpHandler(() => mcpServer);

  await app.register(createMcpPlugin(mcpHandler));

  // Mock downstream APIs
  await app.register(travelRoutes, { prefix: '/mock' });

  app.get('/health', async () => ({ status: 'ok', runtime: process.version }));
  app.get('/meta', async () => webtaskManifest);
  app.get('/', async (request, reply) => {
    reply.type('text/html').send(renderExtensionPage(configReader, request.raw as never, true));
  });

  return app;
}
