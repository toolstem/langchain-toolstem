/**
 * Toolstem SEC EDGAR MCP tools for LangChain.js.
 *
 * Tool names and schemas are discovered live via MCP `tools/list` — no
 * hardcoded list. As of the v0.1 server the proxy exposes 5 tools:
 *   - get_company_filings_summary
 *   - get_insider_signal
 *   - get_institutional_signal
 *   - get_material_events_digest
 *   - compare_disclosure_signals
 *
 * `initialize` and `tools/list` are free. Each `tools/call` costs 0.01 USDC
 * (Base mainnet). Pass `fetch: await createX402Fetch({ privateKey })` to make
 * paid calls automatically.
 *
 * @example
 * ```ts
 * import { createSecTools } from "langchain-toolstem/sec";
 * import { createX402Fetch } from "langchain-toolstem/x402";
 *
 * const fetchPay = await createX402Fetch({ privateKey: process.env.X402_PRIVATE_KEY! });
 * const tools = await createSecTools({ fetch: fetchPay });
 * ```
 */

import type { DynamicStructuredTool } from "@langchain/core/tools";
import { discoverToolstemTools } from "./mcp.js";
import type { ToolstemClientOptions } from "./types.js";

const SEC_URL = "https://mcp.toolstem.com/mcp/sec";

/**
 * Create LangChain tools for the Toolstem SEC EDGAR MCP server.
 *
 * @param opts.fetch    Custom fetch (use `createX402Fetch` to enable paid calls).
 * @param opts.headers  Extra HTTP headers to include in every MCP request.
 * @param opts.url      Override the upstream MCP URL.
 */
export async function createSecTools(
  opts: ToolstemClientOptions = {}
): Promise<DynamicStructuredTool[]> {
  return discoverToolstemTools({
    serverName: "toolstem_sec",
    defaultUrl: SEC_URL,
    opts,
  });
}
