import { createHash } from 'node:crypto';

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null;
}

function safeCode(error: unknown): string | undefined {
  if (!isRecord(error) || typeof error.code !== 'string') return undefined;
  return /^[A-Za-z0-9_.-]{1,80}$/.test(error.code) ? error.code : undefined;
}

/**
 * Correlates authentication failures without retaining a bearer token in logs.
 */
export function tokenDiagnostics(token: string) {
  const segments = token.split('.');
  return {
    fingerprint: createHash('sha256').update(token).digest('hex').slice(0, 12),
    length: token.length,
    segmentCount: segments.length,
    compactJwtShape: segments.length === 3 && segments.every(Boolean),
  };
}

/**
 * Error messages can contain upstream response bodies. Keep diagnostics bounded
 * to structural fields so server logs cannot disclose tokens or form data.
 */
export function errorDiagnostics(error: unknown) {
  const status = isRecord(error) && typeof error.statusCode === 'number'
    ? error.statusCode
    : isRecord(error) && typeof error.status === 'number'
      ? error.status
      : undefined;

  return {
    errorCode: safeCode(error),
    errorName: error instanceof Error ? error.name : typeof error,
    status,
  };
}

/**
 * MCP request parameters may include personal or payment data. Only retain the
 * protocol method and tool name, never params, IDs, or tool arguments.
 */
export function mcpRequestDiagnostics(body: unknown) {
  if (!isRecord(body)) return { mcpMethod: 'unparsed' };

  const mcpMethod = typeof body.method === 'string' ? body.method.slice(0, 120) : 'unknown';
  const params = isRecord(body.params) ? body.params : undefined;
  const toolName = mcpMethod === 'tools/call' && typeof params?.name === 'string'
    ? params.name.slice(0, 120)
    : undefined;

  return { mcpMethod, toolName };
}

export function valueFingerprint(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}

/** Request URLs can contain transport session IDs in their query string. */
export function requestPath(url: string): string {
  return url.split('?', 1)[0] || '/';
}
