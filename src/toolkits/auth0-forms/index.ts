import { registerAppResource, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import type { McpServer } from '@modelcontextprotocol/server';

import { registerTenantForms, type TenantForm } from './tenant-forms.ts';
import { formsSdkUrl, RESOURCE_URI } from './urls.ts';

function injectScript(html: string, src: string): string {
  return html.replace('</head>', `<script src="${src}"></script></head>`);
}

const formsHtml = require('../../apps/dist/auth0-forms/mcp-app.html') as string;

export function registerAuth0FormsTools(server: McpServer, forms: TenantForm[]): void {
  registerTenantForms(server, forms);

  registerAppResource(
    server,
    'Auth0 Forms',
    RESOURCE_URI,
    {
      _meta: {
        ui: {
          // Non-empty domain opts into Inspector's dedicated-origin path,
          // which sandboxes the iframe with allow-same-origin — required for
          // third-party SDKs like Stripe that spawn cross-origin iframes.
          domain: 'localhost',
          csp: {
            resourceDomains: ['*', 'data:', 'blob:'],
            connectDomains: ['*'],
            frameDomains: ['*'],
          },
        },
      },
    },
    async () => {
      const html = injectScript(
        formsHtml,
        formsSdkUrl(),
      );
      return { contents: [{ uri: RESOURCE_URI, mimeType: RESOURCE_MIME_TYPE, text: html }] };
    },
  );
}
