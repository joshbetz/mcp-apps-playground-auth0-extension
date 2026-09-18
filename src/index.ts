import { parseConfig } from './config.ts';
import { buildServer } from './server.ts';

const config = parseConfig(process.env);
const app = await buildServer(config, (key) => process.env[key]);
const port = app.config.PORT;

await app.listen({ port, host: '0.0.0.0' });
app.log.info(`MCP Gateway running on http://localhost:${port}/mcp`);
app.log.info('Test with: npx @modelcontextprotocol/inspector http://localhost:' + port + '/mcp');
