# Config schema contains only fields that are wired in code

The Zod config schema in `src/config.ts` defines every environment variable the server
validates at startup. An unset variable in the schema fails startup immediately. This makes
the schema a load-bearing contract: anything declared there is required of every operator.

## Decision

Only add fields to the config schema when they are actively read by code. Do not add fields
in anticipation of future features — a field that is validated but never read fails startup
for no benefit and misleads readers into thinking the feature is implemented.

Fields removed as dead config (validated, never referenced in code):
- `CRM_AUDIENCE` — upstream OAuth audience for the CRM toolkit's client credentials flow
- `PROFILE_API_AUDIENCE` — upstream OAuth audience for the profile toolkit's token exchange
- `BANKING_AUDIENCE` — upstream OAuth audience for the payments toolkit's token exchange
- `AUTH0_CLIENT_ID` — M2M client ID for the client credentials grant
- `AUTH0_CLIENT_SECRET` — M2M client secret for the client credentials grant

These fields belong to the upstream auth strategies (service-auth and user-delegated
upstream). When those strategies are implemented, the relevant fields are re-added. See
ADR-0001 for the upstream auth model and `challenge-token-vault.md` for deferred work.

## URL constants and config

Base URLs for toolkit fetches (`BANKING_BASE_URL`, `CRM_BASE_URL`, `PROFILE_BASE_URL`) are
hardcoded constants in `toolkits/<domain>/urls.ts` pointing to local mock routes. They are
not in config because all upstream dependencies are mocks running in the same process.
When real upstream APIs replace the mocks, the base URLs move to the config schema.

## Considered options

- **Keep fields with a TODO comment**: rejected — a required env var with no consumer still
  breaks startup and creates false confidence that the feature is wired.
- **Make fields optional (`z.string().optional()`)**: rejected — optional config fields
  hide whether a feature is active or not, making the server's behaviour depend on silent
  absence rather than explicit configuration.
