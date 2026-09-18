import { requestContext } from './context.ts';
import { errorDiagnostics } from '../diagnostics.ts';
import { AuthenticationError, InsufficientScopeError } from './errors.ts';

export interface AuthRequirements {
  scopes?: string | string[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withRequiredAuth<F extends (...args: any[]) => any>(
  requirements: AuthRequirements,
  handler: F,
): F {
  const required = requirements.scopes
    ? Array.isArray(requirements.scopes) ? requirements.scopes : [requirements.scopes]
    : [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (async (...args: any[]) => {
    const ctx = requestContext.getStore();
    if (!ctx) throw new AuthenticationError('Not authenticated');

    if (required.length) {
      const missing = required.filter((s: string) => !ctx.user.scopes.includes(s));
      if (missing.length) {
        ctx.logger.warn(
          {
            event: 'mcp.tool.scope_denied',
            grantedScopeCount: ctx.user.scopes.length,
            mcpMethod: ctx.mcpMethod,
            missingScopes: missing,
            requestId: ctx.requestId,
            requiredScopes: required,
            toolName: ctx.toolName,
          },
          'MCP tool rejected because the token is missing required scopes',
        );
        throw new InsufficientScopeError(`insufficient_scope: ${missing.join(', ')}`);
      }
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (handler as (...a: any[]) => any)(...args);
      ctx.logger.info(
        {
          event: 'mcp.tool.completed',
          mcpMethod: ctx.mcpMethod,
          requestId: ctx.requestId,
          toolName: ctx.toolName,
        },
        'MCP tool completed',
      );
      return result;
    } catch (error) {
      ctx.logger.warn(
        {
          event: 'mcp.tool.failed',
          ...errorDiagnostics(error),
          mcpMethod: ctx.mcpMethod,
          requestId: ctx.requestId,
          toolName: ctx.toolName,
        },
        'MCP tool failed',
      );
      throw error;
    }
  }) as unknown as F;
}
