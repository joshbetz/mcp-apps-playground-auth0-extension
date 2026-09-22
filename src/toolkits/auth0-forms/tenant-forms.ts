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
  injectableFields: TenantFormField[];
  callerSubjectFieldIds: string[];
};

export type TenantFormField = {
  id: string;
  label: string;
  required: boolean;
  type: string;
};

type CachedForms = {
  expiresAt: number;
  forms: TenantForm[];
};

const formsCache = new Map<string, CachedForms>();
const pendingFormsRequests = new Map<string, Promise<TenantForm[]>>();
const RESERVED_EMBED_FIELD_IDS = new Set(["context_token", "__proto__", "constructor", "prototype"]);
const CALLER_SUBJECT_FIELD_ID = "user_id";

function isSafeFieldId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[A-Za-z0-9_-]{1,128}$/.test(value) &&
    !RESERVED_EMBED_FIELD_IDS.has(value)
  );
}

function injectableFieldsFromForm(value: unknown): TenantFormField[] {
  if (typeof value !== "object" || value === null) return [];
  const nodes = (value as { nodes?: unknown }).nodes;
  if (!Array.isArray(nodes)) return [];

  const fields = new Map<string, TenantFormField>();
  for (const node of nodes) {
    if (typeof node !== "object" || node === null) continue;
    const components = (node as { config?: { components?: unknown } }).config?.components;
    if (!Array.isArray(components)) continue;

    for (const component of components) {
      if (typeof component !== "object" || component === null) continue;
      const field = component as {
        category?: unknown;
        id?: unknown;
        label?: unknown;
        required?: unknown;
        sensitive?: unknown;
        type?: unknown;
      };
      if (field.category !== "FIELD" || field.sensitive === true || !isSafeFieldId(field.id)) continue;
      if (typeof field.type !== "string" || !field.type) continue;

      fields.set(field.id, {
        id: field.id,
        label: typeof field.label === "string" && field.label.trim()
          ? field.label.trim().slice(0, 160)
          : field.id,
        required: field.required === true,
        type: field.type.slice(0, 64),
      });
    }
  }

  return [...fields.values()];
}

function callerSubjectFieldsFromForm(value: unknown): string[] {
  if (typeof value !== "object" || value === null) return [];
  const hiddenFields = (value as { start?: { hidden_fields?: unknown } }).start?.hidden_fields;
  if (!Array.isArray(hiddenFields)) return [];

  // A Form opts in by declaring its own hidden `user_id` field. This maps to
  // the verified caller subject and is deliberately separate from agent input.
  return hiddenFields.some(
    (field) =>
      typeof field === "object" &&
      field !== null &&
      (field as { key?: unknown }).key === CALLER_SUBJECT_FIELD_ID,
  )
    ? [CALLER_SUBJECT_FIELD_ID]
    : [];
}

function normalizeForm(value: unknown): TenantForm | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const form = value as { id?: unknown; name?: unknown };
  if (typeof form.id !== "string" || !/^[A-Za-z0-9_-]{1,48}$/.test(form.id))
    return undefined;
  if (typeof form.name !== "string" || !form.name.trim()) return undefined;
  return {
    id: form.id,
    name: form.name.trim().slice(0, 160),
    injectableFields: injectableFieldsFromForm(value),
    callerSubjectFieldIds: callerSubjectFieldsFromForm(value),
  };
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

  const tenantForms = [...forms.values()].sort(
    (left, right) =>
      left.name.localeCompare(right.name) || left.id.localeCompare(right.id),
  );

  // The list endpoint returns a compact Form summary. Fetch each definition so
  // tool inputs always reflect the Form's current non-sensitive fields.
  return Promise.all(
    tenantForms.map(async (form) => {
      try {
        const definition = await managementApiJson<unknown>(
          domain,
          token,
          `forms/${encodeURIComponent(form.id)}`,
        );
        return {
          ...form,
          injectableFields: injectableFieldsFromForm(definition),
          callerSubjectFieldIds: callerSubjectFieldsFromForm(definition),
        };
      } catch {
        // A Form remains usable even if its details are temporarily unavailable;
        // it simply exposes no agent-prefill inputs for this discovery cycle.
        return form;
      }
    }),
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

function formFingerprint(formId: string): string {
  return createHash("sha256")
    .update(formId)
    .digest("hex")
    .slice(0, 12);
}

function formToolBaseName(formName: string, formId: string): string {
  const slug = formName
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    // Leave room for an ID-derived suffix when two Forms normalize to the
    // same tool name. MCP tool names are limited to 128 characters.
    .slice(0, 96);

  return slug ? `open_${slug}` : `open_form_${formFingerprint(formId)}`;
}

function formToolNames(forms: TenantForm[]): Map<string, string> {
  const baseNames = new Map<string, string>();
  const baseNameCounts = new Map<string, number>();

  for (const form of forms) {
    const baseName = formToolBaseName(form.name, form.id);
    baseNames.set(form.id, baseName);
    baseNameCounts.set(baseName, (baseNameCounts.get(baseName) ?? 0) + 1);
  }

  return new Map(
    forms.map((form) => {
      const baseName = baseNames.get(form.id)!;
      const hasNameCollision = (baseNameCounts.get(baseName) ?? 0) > 1;
      return [
        form.id,
        hasNameCollision ? `${baseName}_${formFingerprint(form.id)}` : baseName,
      ];
    }),
  );
}

export function registerTenantForms(
  server: McpServer,
  forms: TenantForm[],
): void {
  const toolNames = formToolNames(forms);

  for (const form of forms) {
    const inputSchema = z.object(
      Object.fromEntries(
        form.injectableFields.map((field) => [
          field.id,
          z
            .string()
            .min(1)
            .max(512)
            .optional()
            .describe(
              `${field.label}${field.required ? " (required in the Form)" : ""}. ` +
                "If known from context, pre-fill this field; otherwise omit it so the Form can collect it from the user.",
            ),
        ]),
      ),
    );

    registerAppTool(
      server,
      toolNames.get(form.id)!,
      {
        description: `Open the Auth0 Form “${form.name}” as a sandboxed MCP App. Non-sensitive Form fields can be pre-filled from agent context; sensitive fields stay inside the iframe and never transit through the LLM.`,
        inputSchema,
        _meta: { ui: { resourceUri: RESOURCE_URI } },
      },
      withRequiredAuth({ scopes: "read:account" }, async (input: Record<string, unknown>) => {
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
        const prefill = Object.fromEntries(
          form.injectableFields.flatMap((field) => {
            const value = input[field.id];
            return typeof value === "string" ? [[field.id, value] as const] : [];
          }),
        );
        const trustedFields = Object.fromEntries(
          form.callerSubjectFieldIds.map((fieldId) => [fieldId, user.sub]),
        );
        return {
          content: [
            {
              type: "text" as const,
              text: `${form.name} form ready. Complete it in the panel.`,
            },
          ],
          _meta: { contextJwt },
          structuredContent: {
            formId: form.id,
            prefill,
            trustedFields,
            successMessage: `${form.name} completed.`,
          },
        };
      }),
    );
  }
}
