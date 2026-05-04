/**
 * Toolstem SEC EDGAR MCP tools for LangChain.js.
 *
 * Available tools:
 *   - get_insider_signals        — Form 4 insider buy/sell signals
 *   - get_institutional_holdings — 13-F institutional position data
 *   - get_material_events        — 8-K material event disclosures
 *   - get_earnings_signals       — Earnings surprise and guidance signals
 *   - get_filings_summary        — Aggregated EDGAR filings overview
 *
 * Authentication:
 *   - Apify token:  pass `apifyToken` in opts.
 *   - x402 (USDC):  omit token; start a proxy with createX402Proxy() and pass the
 *                   proxy URL via the parent MultiServerMCPClient instead.
 *
 * @example
 * ```ts
 * import { createSecTools } from "langchain-toolstem/sec";
 *
 * const tools = await createSecTools({ apifyToken: process.env.APIFY_TOKEN });
 * ```
 */

import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import type { StructuredTool } from "@langchain/core/tools";
import type { ToolstemClientOptions } from "./types.js";

const SEC_URL = "https://mcp.toolstem.com/mcp/sec";

/**
 * Create LangChain StructuredTool instances for the Toolstem SEC EDGAR MCP server.
 *
 * @param opts.apifyToken  Apify API token for simple auth (no wallet required).
 * @param opts.headers     Extra headers merged with auth header (if any).
 * @returns Array of LangChain StructuredTool instances ready to pass to an agent.
 */
export async function createSecTools(
  opts: ToolstemClientOptions = {}
): Promise<StructuredTool[]> {
  const { apifyToken, headers: extraHeaders = {} } = opts;

  const headers: Record<string, string> = { ...extraHeaders };
  if (apifyToken) {
    headers["Authorization"] = `Bearer ${apifyToken}`;
  }

  const client = new MultiServerMCPClient({
    toolstem_sec: {
      transport: "http",
      url: SEC_URL,
      ...(Object.keys(headers).length > 0 ? { headers } : {}),
    },
  });

  return client.getTools() as Promise<StructuredTool[]>;
}
