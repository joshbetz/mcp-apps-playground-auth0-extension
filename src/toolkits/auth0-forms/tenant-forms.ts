import { createHash, randomUUID } from "node:crypto";

import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/server";
import jwt from "jsonwebtoken";
import { z } from "zod";

import { RESOURCE_URI } from "./urls.ts";
import {
  managementAccessToken,
  managementApiJson,
  type ConfigReader,
} from "../../app.ts";
import { requireEnv } from "../../env.ts";
import { getCallerUser, withRequiredAuth } from "../../server/index.ts";

const CONTEXT_JWT_TTL = "5m";
const FORMS_CACHE_TTL_MS = 60_000;

export type TenantForm = {
  id: string;
  name: string;
};

type CachedForms = {
  expiresAt: number;
  forms: TenantForm[];
};

const formsCache = new Map<string, CachedForms>();
const pendingFormsRequests = new Map<string, Promise<TenantForm[]>>();

function normalizeForm(value: unknown): TenantForm | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const form = value as { id?: unknown; name?: unknown };
  if (typeof form.id !== "string" || !/^[A-Za-z0-9_-]{1,48}$/.test(form.id))
    return undefined;
  if (typeof form.name !== "string" || !form.name.trim()) return undefined;
  return { id: form.id, name: form.name.trim().slice(0, 160) };
}

function formValuesFromResponse(response: unknown): unknown[] {
  return Array.isArray(response)
    ? response
    : typeof response === "object" &&
        response !== null &&
        Array.isArray((response as { forms?: unknown }).forms)
      ? (response as { forms: unknown[] }).forms
      : [];
}

function formsFromResponse(response: unknown): TenantForm[] {
  return formValuesFromResponse(response)
    .map(normalizeForm)
    .filter((form): form is TenantForm => form !== undefined)
    .sort(
      (left, right) =>
        left.name.localeCompare(right.name) || left.id.localeCompare(right.id),
    );
}

function cacheKey(config: ConfigReader): string {
  return config("AUTH0_DOMAIN")?.trim().toLowerCase() ?? "";
}

async function fetchTenantForms(config: ConfigReader): Promise<TenantForm[]> {
  const { domain, token } = await managementAccessToken(config);
  const forms = new Map<string, TenantForm>();
  const perPage = 100;

  for (let page = 0; page < 20; page += 1) {
    const response = await managementApiJson<unknown>(
      domain,
      token,
      `forms?page=${page}&per_page=${perPage}`,
    );
    for (const form of formsFromResponse(response)) forms.set(form.id, form);
    if (formValuesFromResponse(response).length < perPage) break;
  }

  return [...forms.values()].sort(
    (left, right) =>
      left.name.localeCompare(right.name) || left.id.localeCompare(right.id),
  );
}

export async function listTenantForms(
  config: ConfigReader,
): Promise<TenantForm[]> {
  const key = cacheKey(config);
  const now = Date.now();
  const cached = formsCache.get(key);
  if (cached && cached.expiresAt > now) return cached.forms;

  const pending = pendingFormsRequests.get(key);
  if (pending) return pending;

  const request = fetchTenantForms(config)
    .then((forms) => {
      formsCache.set(key, {
        expiresAt: Date.now() + FORMS_CACHE_TTL_MS,
        forms,
      });
      return forms;
    })
    .finally(() => {
      pendingFormsRequests.delete(key);
    });
  pendingFormsRequests.set(key, request);
  return request;
}

function formToolName(formId: string): string {
  const fingerprint = createHash("sha256")
    .update(formId)
    .digest("hex")
    .slice(0, 12);
  return `open_auth0_form_${fingerprint}`;
}

export function registerTenantForms(
  server: McpServer,
  forms: TenantForm[],
): void {
  for (const form of forms) {
    registerAppTool(
      server,
      formToolName(form.id),
      {
        description: `Open the Auth0 Form “${form.name}” as a sandboxed MCP App. Sensitive fields stay inside the iframe and never transit through the LLM.`,
        inputSchema: z.object({}),
        _meta: { ui: { resourceUri: RESOURCE_URI } },
      },
      withRequiredAuth({ scopes: "read:account" }, async () => {
        const user = getCallerUser();
        const contextJwt = jwt.sign(
          {
            sub: user.sub,
            email: user.email,
            name: user.name,
            nonce: randomUUID(),
          },
          requireEnv("SESSION_SECRET"),
          { expiresIn: CONTEXT_JWT_TTL },
        );
        return {
          content: [
            {
              type: "text" as const,
              text: `${form.name} form ready. Complete it in the panel.`,
            },
          ],
          structuredContent: {
            formId: form.id,
            contextJwt,
            successMessage: `${form.name} completed.`,
          },
        };
      }),
    );
  }
}
