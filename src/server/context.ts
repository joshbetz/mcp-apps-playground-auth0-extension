import { AsyncLocalStorage } from 'node:async_hooks';

import type { VerifiedAccessTokenClaims } from '@auth0/auth0-api-js';
import type { AuthInfo } from '@modelcontextprotocol/server';

export type RequestUser = {
  sub: string;
  clientId?: string;
  orgId?: string;
  expiresAt: number;
  scopes: string[];
  permissions: string[];
  email?: string;
  name?: string;
};

interface RequestContext {
  token: string;
  user: RequestUser;
  publicBaseUrl: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

export function getCallerToken(): string {
  const ctx = requestContext.getStore();
  if (!ctx) throw new Error('getCallerToken called outside of request context');
  return ctx.token;
}

export function getCallerUser(): RequestUser {
  const ctx = requestContext.getStore();
  if (!ctx) throw new Error('getCallerUser called outside of request context');
  return ctx.user;
}

export function getPublicBaseUrl(): string {
  const ctx = requestContext.getStore();
  if (!ctx) throw new Error('getPublicBaseUrl called outside of request context');
  return ctx.publicBaseUrl;
}

export function buildUser(claims: VerifiedAccessTokenClaims): RequestUser {
  if (typeof claims.sub !== 'string' || !claims.sub) {
    throw new Error('Token missing sub claim');
  }
  if (typeof claims.exp !== 'number') {
    throw new Error('Token missing exp claim');
  }

  const scopeString = typeof claims['scope'] === 'string' ? claims['scope'] : '';
  const scopes = scopeString ? scopeString.split(' ').filter(Boolean) : [];

  const rawPerms = claims['permissions'];
  const permissions = Array.isArray(rawPerms)
    ? rawPerms.filter((p): p is string => typeof p === 'string')
    : [];

  const rawClientId = claims['client_id'];
  const rawAzp = claims['azp'];
  const clientId =
    typeof rawClientId === 'string' && rawClientId ? rawClientId
    : typeof rawAzp === 'string' && rawAzp ? rawAzp
    : undefined;

  return {
    sub: claims.sub,
    clientId,
    orgId: typeof claims['org_id'] === 'string' ? claims['org_id'] : undefined,
    expiresAt: claims.exp,
    scopes,
    permissions,
    email: typeof claims['email'] === 'string' ? claims['email'] : undefined,
    name: typeof claims['name'] === 'string' ? claims['name'] : undefined,
  };
}

export function buildAuthInfo(user: RequestUser, token: string): AuthInfo {
  return {
    token,
    clientId: user.clientId ?? user.sub,
    scopes: user.scopes,
    expiresAt: user.expiresAt,
    extra: { user }, // project extension — not part of the MCP SDK AuthInfo spec (see ADR-0003)
  };
}

export function buildRequestContext(user: RequestUser, token: string, publicBaseUrl: string): RequestContext {
  return { token, user, publicBaseUrl };
}

// req.raw.auth is set in plugins/mcp.ts via buildAuthInfo.
// toNodeHandler forwards it as ctx.http.authInfo in tool handlers (official SDK convention — see ADR-0003).
declare module 'http' {
  interface IncomingMessage {
    auth?: AuthInfo;
  }
}
