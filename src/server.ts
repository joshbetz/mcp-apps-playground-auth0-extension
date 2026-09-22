import { McpServer, createMcpHandler } from '@modelcontextprotocol/server';
import fastifyExpress from '@fastify/express';
import Fastify from 'fastify';

import { createExtensionApp, renderExtensionPage } from './app.ts';
import { type Config, configPlugin } from './config.ts';
import { errorDiagnostics } from './diagnostics.ts';
import travelRoutes from './mock/travel.ts';
import { authPlugin } from './plugins/auth.ts';
import corsPlugin from './plugins/cors.ts';
import createMcpPlugin from './plugins/mcp.ts';
import { registerAuth0FormsTools } from './toolkits/auth0-forms/index.ts';
import { listTenantForms, type TenantForm } from './toolkits/auth0-forms/tenant-forms.ts';
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

  const mcpHandler = createMcpHandler(async ({ authInfo }) => {
    const mcpServer = new McpServer({ name: 'mcp-server', version: '1.0.0' });

    registerRecommendationsTools(mcpServer);
    registerHistoryTools(mcpServer);
    registerBookingsTools(mcpServer);

    // The factory executes after the MCP bearer token has been verified and
    // is request-scoped by the SDK. Forms are read only for callers that can
    // open account forms; the Management API response is never sent to logs.
    let forms: TenantForm[] = [];
    if (authInfo?.scopes.includes('read:account')) {
      try {
        forms = await listTenantForms(configReader);
        app.log.info({ event: 'forms.discovery.completed', formCount: forms.length }, 'Tenant Forms discovered');
      } catch (error) {
        app.log.warn(
          { event: 'forms.discovery.failed', ...errorDiagnostics(error) },
          'Unable to discover tenant Forms',
        );
      }
    }
    registerAuth0FormsTools(mcpServer, forms);

    return mcpServer;
  });

  await app.register(createMcpPlugin(mcpHandler));

  // Mock downstream APIs
  await app.register(travelRoutes, { prefix: '/mock' });

  app.get('/health', async () => ({ status: 'ok', runtime: process.version }));
  // Match the Custom Extension template: make the import manifest publicly
  // available at /meta for Auth0's legacy extension loader.
  app.get('/meta', async (_request, reply) => reply.code(200).send(webtaskManifest));
  app.get('/', async (request, reply) => {
    reply.type('text/html').send(renderExtensionPage(configReader, request.raw as never, true));
  });

  return app;
}
