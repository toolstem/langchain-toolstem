/**
 * Toolstem Finance MCP tools for LangChain.js.
 *
 * Tool names and schemas are discovered live via MCP `tools/list` — no
 * hardcoded list. As of the v1.2 server the proxy exposes 3 tools:
 *   - get_stock_snapshot
 *   - get_company_metrics
 *   - compare_companies
 *
 * `initialize` and `tools/list` are free. Each `tools/call` costs 0.01 USDC
 * (Base mainnet). Pass `fetch: await createX402Fetch({ privateKey })` to make
 * paid calls automatically.
 *
 * @example
 * ```ts
 * import { createFinanceTools } from "langchain-toolstem/finance";
 * import { createX402Fetch } from "langchain-toolstem/x402";
 *
 * const fetchPay = await createX402Fetch({ privateKey: process.env.X402_PRIVATE_KEY! });
 * const tools = await createFinanceTools({ fetch: fetchPay });
 * ```
 */

import type { DynamicStructuredTool } from "@langchain/core/tools";
import { discoverToolstemTools } from "./mcp.js";
import type { ToolstemClientOptions } from "./types.js";

const FINANCE_URL = "https://mcp.toolstem.com/mcp/finance";

/**
 * Create LangChain tools for the Toolstem Finance MCP server.
 *
 * @param opts.fetch    Custom fetch (use `createX402Fetch` to enable paid calls).
 * @param opts.headers  Extra HTTP headers to include in every MCP request.
 * @param opts.url      Override the upstream MCP URL.
 */
export async function createFinanceTools(
  opts: ToolstemClientOptions = {}
): Promise<DynamicStructuredTool[]> {
  return discoverToolstemTools({
    serverName: "toolstem_finance",
    defaultUrl: FINANCE_URL,
    opts,
  });
}
