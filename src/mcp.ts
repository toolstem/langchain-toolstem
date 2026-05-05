/**
 * Internal MCP discovery helper — connects to a Toolstem MCP server, runs
 * `initialize` + `tools/list` (both free), and returns LangChain tools.
 *
 * Uses `StreamableHTTPClientTransport` from the MCP SDK directly because it
 * accepts a custom `fetch`, which is how we route `tools/call` through an
 * x402-paying fetch from `createX402Fetch`. `MultiServerMCPClient` from
 * `@langchain/mcp-adapters` does not currently expose that hook.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { loadMcpTools } from "@langchain/mcp-adapters";
import type { DynamicStructuredTool } from "@langchain/core/tools";
import type { ToolstemClientOptions } from "./types.js";

interface ConnectArgs {
  serverName: string;
  defaultUrl: string;
  opts: ToolstemClientOptions;
}

/**
 * Connect to a Toolstem MCP endpoint, list its tools, and return them as
 * LangChain DynamicStructuredTool instances. Tool names and schemas are taken
 * from the live `tools/list` response — no hardcoded names.
 */
export async function discoverToolstemTools(
  args: ConnectArgs
): Promise<DynamicStructuredTool[]> {
  const { serverName, defaultUrl, opts } = args;
  const url = new URL(opts.url ?? defaultUrl);

  const transportOpts: ConstructorParameters<typeof StreamableHTTPClientTransport>[1] = {};
  if (opts.fetch) transportOpts.fetch = opts.fetch as typeof fetch;
  if (opts.headers && Object.keys(opts.headers).length > 0) {
    transportOpts.requestInit = { headers: opts.headers };
  }

  const transport = new StreamableHTTPClientTransport(url, transportOpts);
  const client = new Client(
    { name: "langchain-toolstem", version: "0.1.2" },
    { capabilities: {} }
  );
  await client.connect(transport);

  const tools = await loadMcpTools(serverName, client);
  return tools;
}
