import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../client.js';
import { registerTaskTools } from './taskTools.js';
import { registerTimeslotTools } from './timeslotTools.js';
import { registerTodoTools } from './todoTools.js';
import { registerReportTools } from './reportTools.js';
import { registerDataTools } from './dataTools.js';
import { registerSettingsTools } from './settingsTools.js';

export function registerAllTools(server: McpServer, api: ApiClient): void {
  registerTaskTools(server, api);
  registerTimeslotTools(server, api);
  registerTodoTools(server, api);
  registerReportTools(server, api);
  registerDataTools(server, api);
  registerSettingsTools(server, api);
}
