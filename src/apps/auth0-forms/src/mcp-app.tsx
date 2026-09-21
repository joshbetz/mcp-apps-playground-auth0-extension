import type {
  McpUiToolResultNotification,
  McpUiHostContextChangedNotification,
} from '@modelcontextprotocol/ext-apps';
import { useApp, applyDocumentTheme } from '@modelcontextprotocol/ext-apps/react';
import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

import styles from './mcp-app.module.css';
import type { FormsToolOutput } from '../../../toolkits/auth0-forms/types.ts';
import '../../global.css';

declare global {
  interface Window {
    Auth0Forms?: {
      embed(
        formId: string,
        container: string | Element,
        opts?: { state?: string; fields?: Record<string, string> },
      ): Promise<{ goToFirstStep(): void }>;
    };
  }
}

const SDK_INIT_EVENT = 'af-init';
const FORM_SUCCESS_EVENT = 'af-submitForm-success';

function App() {
  const [formData, setFormData] = useState<FormsToolOutput | null>(null);
  const [sdkReady, setSdkReady] = useState(() => !!window.Auth0Forms);
  const [embedError, setEmbedError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const embeddedFormKeyRef = useRef<string | null>(null);

  const { app, isConnected, error } = useApp({
    appInfo: { name: 'auth0-forms', version: '1.0.0' },
    capabilities: {},
    onAppCreated: (app) => {
      app.onteardown = async () => ({});

      app.onhostcontextchanged = (
        notification: McpUiHostContextChangedNotification['params'],
      ) => {
        if (notification.theme) applyDocumentTheme(notification.theme);
      };

      app.ontoolresult = (params: McpUiToolResultNotification['params']) => {
        setFormData(params.structuredContent as FormsToolOutput);
      };
    },
  });

  // Track SDK readiness — the script is pre-injected in the HTML but loads async.
  useEffect(() => {
    if (window.Auth0Forms) {
      setSdkReady(true);
      return;
    }
    function handleInit(): void {
      setSdkReady(true);
    }
    document.addEventListener(SDK_INIT_EVENT, handleInit, { once: true });
    return () => document.removeEventListener(SDK_INIT_EVENT, handleInit);
  }, []);

  // Embed the form once the SDK is ready and the container is in the DOM.
  useEffect(() => {
    if (!sdkReady || !formData || !containerRef.current) return;

    const container = containerRef.current;
    const data = formData;
    const embedKey = `${data.formId}\u0000${data.contextJwt}`;

    // MCP hosts can replay a tool-result notification. The Forms SDK appends
    // its iframe to the supplied element, so embedding the same result again
    // would show the form twice.
    if (embeddedFormKeyRef.current === embedKey) return;

    embeddedFormKeyRef.current = embedKey;
    setEmbedError(false);
    container.replaceChildren();
    let cancelled = false;

    async function embed(): Promise<void> {
      try {
        await window.Auth0Forms!.embed(data.formId, container, {
          // The MCP server derives prefill fields from the Form definition and
          // never includes sensitive fields. Keep the context token last so it
          // cannot be overridden by a Form field value.
          fields: { ...data.prefill, context_token: data.contextJwt },
        });
      } catch {
        if (cancelled || embeddedFormKeyRef.current !== embedKey) return;
        embeddedFormKeyRef.current = null;
        setEmbedError(true);
      }
    }
    void embed();

    return () => {
      cancelled = true;
    };
  }, [sdkReady, formData]);

  // Listen for form submission and close the app.
  useEffect(() => {
    if (!app || !formData) return;

    const { successMessage } = formData;

    async function handleSuccess(): Promise<void> {
      try {
        await app!.sendMessage({
          role: 'user',
          content: [{ type: 'text', text: successMessage }],
        });
      } catch {
        // sendMessage is best-effort — teardown regardless
      }
      await app!.requestTeardown();
    }

    document.addEventListener(FORM_SUCCESS_EVENT, handleSuccess, { once: true });
    return () => document.removeEventListener(FORM_SUCCESS_EVENT, handleSuccess);
  }, [app, formData]);

  if (error) return <div className={styles.danger}>Connection error: {error.message}</div>;
  if (!isConnected) return <div className={styles.muted}>Connecting…</div>;

  if (embedError) return <div className={styles.danger}>Failed to load form.</div>;

  return (
    <div className={styles.wrapper}>
      {!formData && (
        <div className={styles.spinnerWrap}>
          <div className={styles.spinner} />
        </div>
      )}
      <div className={styles.formContainer} ref={containerRef} />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
