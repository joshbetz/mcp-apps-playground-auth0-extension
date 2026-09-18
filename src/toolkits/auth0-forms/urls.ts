import { requireEnv } from '../../env.ts';

export function formsSdkUrl(): string {
  return `https://${requireEnv('AUTH0_DOMAIN')}/forms/sdk/forms.js`;
}
export const RESOURCE_URI = 'ui://auth0-forms/mcp-app.html';
