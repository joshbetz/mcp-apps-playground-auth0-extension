import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import http from "node:http";
import { isDeepStrictEqual } from "node:util";

const require = createRequire(import.meta.url);
const handler = require("../dist/extension.js");
const webtaskManifest = JSON.parse(readFileSync(new URL("../webtask.json", import.meta.url), "utf8"));
if (typeof handler !== "function") {
  throw new Error(`Webtask requires the bundle to export a bare function, got ${typeof handler}`);
}
const context = {
  data: {
    AUTH0_DOMAIN: "tenant.example.auth0.com",
    AUTH0_CLIENT_ID: "client",
    AUTH0_CLIENT_SECRET: "secret",
    EXTENSION_SECRET: "01234567890123456789012345678901",
    SESSION_SECRET: "01234567890123456789012345678901",
  },
  secrets: {},
};

function request(port, method, path) {
  return new Promise((resolve, reject) => {
    const request = http.request({ host: "127.0.0.1", method, path, port }, (response) => {
      let body = "";
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        resolve({ body, headers: response.headers, location: response.headers.location, status: response.statusCode });
      });
    });
    request.on("error", reject);
    request.end();
  });
}

const USE_WILDCARD_DOMAIN = 3;

const server = http.createServer((req, res) => {
  req.x_wt = { container: "mcp-apps-playground", jtn: "mcp-apps-playground", url_format: USE_WILDCARD_DOMAIN };
  handler(context, req, res);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

try {
  const port = server.address().port;
  const landing = await request(port, "GET", "/mcp-apps-playground/");
  const meta = await request(port, "GET", "/mcp-apps-playground/meta");
  const login = await request(port, "GET", "/mcp-apps-playground/.extensions/setup/login");
  const provision = await request(port, "POST", "/mcp-apps-playground/setup/provision");
  const status = await request(port, "GET", "/mcp-apps-playground/setup/status");
  const promote = await request(port, "POST", "/mcp-apps-playground/setup/connections/con_test/promote");
  const dcrEnable = await request(port, "POST", "/mcp-apps-playground/setup/dcr/enable");
  const cimdEnable = await request(port, "POST", "/mcp-apps-playground/setup/cimd/enable");
  const mcp = await request(port, "POST", "/mcp-apps-playground/mcp");
  const metadata = await request(port, "GET", "/mcp-apps-playground/.well-known/oauth-protected-resource/mcp");
  const mockTravel = await request(port, "GET", "/mcp-apps-playground/mock/travel/history");

  if (landing.status !== 200 || !landing.body.includes("Sign in and provision")) {
    throw new Error(`Unexpected landing response: ${landing.status}`);
  }
  if (
    !landing.body.includes("https://github.com/mustafadeel/auth0-ext-wellknown") ||
    !landing.body.includes("read:destinations read:bookings bookings:write read:account")
  ) {
    throw new Error("Bootstrap page does not include the OAuth discovery extension configuration.");
  }
  if (meta.status !== 200 || !isDeepStrictEqual(JSON.parse(meta.body), webtaskManifest)) {
    throw new Error(`Unexpected meta response: ${meta.status} ${meta.body}`);
  }
  const expectedSetupCallback = encodeURIComponent(`https://127.0.0.1:${port}/mcp-apps-playground/.extensions/setup/login/callback`);
  if (
    login.status !== 302 ||
    !String(login.location).includes("/authorize") ||
    !String(login.location).includes(`redirect_uri=${expectedSetupCallback}`)
  ) {
    throw new Error(`Unexpected login response: ${login.status} ${login.location}`);
  }
  if (provision.status !== 401) {
    throw new Error(`Expected unauthenticated provisioning to be rejected, received ${provision.status}`);
  }
  if (status.status !== 401) {
    throw new Error(`Expected unauthenticated setup status to be rejected, received ${status.status}`);
  }
  if (promote.status !== 401) {
    throw new Error(`Expected unauthenticated connection promotion to be rejected, received ${promote.status}`);
  }
  if (dcrEnable.status !== 401) {
    throw new Error(`Expected unauthenticated DCR enable to be rejected, received ${dcrEnable.status}`);
  }
  if (cimdEnable.status !== 401) {
    throw new Error(`Expected unauthenticated CIMD enable to be rejected, received ${cimdEnable.status}`);
  }
  if (mcp.status !== 401 || !String(mcp.headers["www-authenticate"]).includes("resource_metadata")) {
    throw new Error(`Expected an OAuth discovery challenge for MCP, received ${mcp.status}`);
  }
  const protectedResource = JSON.parse(metadata.body);
  if (metadata.status !== 200 || protectedResource.resource !== `http://127.0.0.1:${port}/mcp-apps-playground/mcp`) {
    throw new Error(`Unexpected protected-resource metadata: ${metadata.status} ${metadata.body}`);
  }
  if (mockTravel.status !== 401) {
    throw new Error(`Expected the original Fastify mock route to require a bearer header, received ${mockTravel.status}`);
  }

  console.log(
    `landing=${landing.status} meta=${meta.status} login=${login.status} provision=${provision.status} status=${status.status} promote=${promote.status} dcrEnable=${dcrEnable.status} cimdEnable=${cimdEnable.status} mcp=${mcp.status} protectedResource=${metadata.status} mockTravel=${mockTravel.status}`,
  );
} finally {
  await new Promise((resolve) => server.close(resolve));
}
