import type { IncomingMessage, ServerResponse } from 'node:http';

import { parseConfig } from './config.ts';
import { runtimeConfig } from './env.ts';
import { buildServer } from './server.ts';

const webtaskTools = require('webtask-tools') as {
  fromConnect: (app: (req: WebtaskRequest, res: ServerResponse) => void) => (
    context: WebtaskContext,
    req: WebtaskRequest,
    res: ServerResponse,
  ) => void;
};

interface WebtaskContext {
  data?: Record<string, unknown>;
  secrets?: Record<string, unknown>;
  [key: string]: unknown;
}

interface WebtaskRequest extends IncomingMessage {
  webtaskContext?: WebtaskContext;
  originalUrl?: string;
  x_wt?: {
    container?: string;
    jtn?: string;
    ectx?: {
      PUBLIC_WT_URL?: unknown;
    };
  };
}

function readContextValue(context: WebtaskContext, key: string): string | undefined {
  for (const source of [context.data, context.secrets, context]) {
    const value = source?.[key];
    if (typeof value === 'string') return value;
  }

  const environmentValue = process.env[key];
  return typeof environmentValue === 'string' ? environmentValue : undefined;
}

function requestHeader(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name.toLowerCase()];
  return typeof value === 'string' ? value : Array.isArray(value) ? value[0] : undefined;
}

function installedBaseUrl(context: WebtaskContext, req: WebtaskRequest): string {
  const webtaskUrl = req.x_wt?.ectx?.PUBLIC_WT_URL;
  if (typeof webtaskUrl === 'string' && webtaskUrl) return webtaskUrl.replace(/\/$/, '');

  const configuredWebtaskUrl = readContextValue(context, 'PUBLIC_WT_URL');
  if (configuredWebtaskUrl) return configuredWebtaskUrl.replace(/\/$/, '');

  const host = requestHeader(req, 'x-forwarded-host') ?? requestHeader(req, 'host');
  if (!host) throw new Error('Unable to determine the installed Webtask URL.');
  const protocol = requestHeader(req, 'x-forwarded-proto') ?? (host.startsWith('127.') || host.startsWith('localhost') ? 'http' : 'https');
  const pathname = (req.originalUrl ?? req.url ?? '/').split('?', 1)[0];
  const routeSuffix = [
    '/.extensions/setup/login',
    '/.well-known/oauth-protected-resource/mcp',
    '/.well-known/oauth-protected-resource',
    '/setup/provision',
    '/setup/status',
    '/health',
    '/meta',
    '/mcp',
  ].find((suffix) => pathname.endsWith(suffix));
  const basePath = routeSuffix ? pathname.slice(0, -routeSuffix.length) : pathname === '/' ? '' : pathname;
  return `${protocol}://${host}${basePath}`.replace(/\/$/, '');
}

const handler = webtaskTools.fromConnect((req: WebtaskRequest, res: ServerResponse) => {
  const context = req.webtaskContext ?? {};
  const installedBase = installedBaseUrl(context, req);
  const publicBase = (readContextValue(context, 'PUBLIC_BASE_URL') ?? installedBase).replace(/\/$/, '');
  const configReader = (key: string) => key === 'PUBLIC_WT_URL' ? installedBase : readContextValue(context, key);
  const config = parseConfig({
    AUTH0_AUDIENCE: `${publicBase}/mcp`,
    AUTH0_DOMAIN: configReader('AUTH0_DOMAIN'),
    SERVER_URL: publicBase,
    SESSION_SECRET: configReader('SESSION_SECRET'),
  });

  void runtimeConfig.run(configReader, async () => {
    const server = await buildServer(config, configReader, req as never);
    res.once('finish', () => void server.close());
    res.once('close', () => void server.close());
    await server.ready();
    server.routing(req, res);
  }).catch((error: unknown) => {
    if (res.headersSent) return;
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: 'internal_error', message: 'Unable to start the MCP extension.' }));
    console.error('[mcp-apps-playground] startup failed', error);
  });
});

module.exports = handler;
