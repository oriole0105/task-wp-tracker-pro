import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { ApiClient } from '@tt/mcp/client';
import { registerTaskTools } from '@tt/mcp/tools/tasks';
import { registerTimeslotTools } from '@tt/mcp/tools/timeslots';
import { registerTodoTools } from '@tt/mcp/tools/todos';
import { registerReportTools } from '@tt/mcp/tools/reports';
import { registerDataTools } from '@tt/mcp/tools/data';
import type { Hono } from 'hono';

export interface McpHandlerEnv {
  TT_TOKEN: string;
}

/**
 * Handle MCP over HTTP requests for Cloudflare Workers.
 *
 * Uses an internal fetcher so tool handlers call app.fetch() directly
 * (no network round trip) while reusing the same tool registration code
 * as the stdio MCP server.
 */
export async function handleMcpRequest(
  app: Hono,
  env: McpHandlerEnv,
  request: Request,
): Promise<Response> {
  const server = new McpServer({ name: 'task-time-tracker', version: '1.0.0' });
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless — safe for multi-instance Workers
    enableJsonResponse: true,
  });

  const origin = new URL(request.url).origin;

  // Route API calls through the Hono app in-process instead of over the network
  const internalFetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url;
    const normalized = url.startsWith('http') ? url : `${origin}${url}`;
    return Promise.resolve(app.fetch(new Request(normalized, init), env));
  };

  const api = new ApiClient({
    base: origin,
    token: env.TT_TOKEN,
    fetcher: internalFetch,
  });

  registerTaskTools(server, api);
  registerTimeslotTools(server, api);
  registerTodoTools(server, api);
  registerReportTools(server, api);
  registerDataTools(server, api);

  await server.connect(transport);
  return transport.handleRequest(request);
}
