import { requestContext } from './context.ts';
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
        throw new InsufficientScopeError(`insufficient_scope: ${missing.join(', ')}`);
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (handler as (...a: any[]) => any)(...args);
  }) as unknown as F;
}
