import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ApiClient } from './client.js';
import { registerAllTools } from './tools/index.js';

const server = new McpServer({
  name: 'task-time-tracker',
  version: '1.0.0',
});

const api = new ApiClient();

registerAllTools(server, api);

const transport = new StdioServerTransport();
await server.connect(transport);
