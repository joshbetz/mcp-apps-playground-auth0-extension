export class McpGatewayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class InsufficientScopeError extends McpGatewayError {}
export class AuthenticationError extends McpGatewayError {}

// Prevents header injection: strips quotes and newlines before embedding in WWW-Authenticate.
export function sanitizeDescription(message: string): string {
  return message.replaceAll('"', "'").replace(/[\r\n]/g, ' ');
}
