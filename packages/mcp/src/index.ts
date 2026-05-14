import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ApiClient } from './client.js';
import { registerTaskTools } from './tools/taskTools.js';
import { registerTimeslotTools } from './tools/timeslotTools.js';
import { registerTodoTools } from './tools/todoTools.js';
import { registerReportTools } from './tools/reportTools.js';
import { registerDataTools } from './tools/dataTools.js';

const server = new McpServer({
  name: 'task-time-tracker',
  version: '1.0.0',
});

const api = new ApiClient();

registerTaskTools(server, api);
registerTimeslotTools(server, api);
registerTodoTools(server, api);
registerReportTools(server, api);
registerDataTools(server, api);

const transport = new StdioServerTransport();
await server.connect(transport);
