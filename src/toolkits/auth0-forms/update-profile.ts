import { randomUUID } from 'node:crypto';

import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import type { McpServer } from '@modelcontextprotocol/server';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

import { RESOURCE_URI } from './urls.ts';
import { requireEnv } from '../../env.ts';
import { getCallerUser, withRequiredAuth } from '../../server/index.ts';

const FORM_ID = 'ap_bjZ5qS6RUiyBZXvrL4Fkku';
const CONTEXT_JWT_TTL = '5m';

export function registerUpdateProfile(server: McpServer): void {
  registerAppTool(
    server,
    'update_profile',
    {
      description:
        'Opens a secure profile information update form as a sandboxed MCP App. Sensitive fields stay inside the iframe and never transit through the LLM.',
      inputSchema: z.object({}),
      _meta: { ui: { resourceUri: RESOURCE_URI } },
    },
    withRequiredAuth({ scopes: 'read:account' }, async () => {
      const user = getCallerUser();
      const contextJwt = jwt.sign(
        { sub: user.sub, email: user.email, name: user.name, nonce: randomUUID() },
        requireEnv('SESSION_SECRET'),
        { expiresIn: CONTEXT_JWT_TTL },
      );
      return {
        content: [{ type: 'text' as const, text: 'Profile information form ready. Complete it in the panel.' }],
        structuredContent: { formId: FORM_ID, contextJwt, successMessage: 'Profile information updated.' },
      };
    }),
  );
}
