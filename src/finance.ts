/**
 * Toolstem Finance MCP tools for LangChain.js.
 *
 * Available tools:
 *   - get_stock_snapshot   — real-time price, volume, change
 *   - get_company_metrics  — P/E, EPS, market cap, revenue growth, etc.
 *   - compare_companies    — side-by-side metric comparison for multiple tickers
 *
 * Authentication:
 *   - Apify token:  pass `apifyToken` in opts. One-time credential, no wallet needed.
 *   - x402 (USDC):  omit token; start a proxy with createX402Proxy() and pass the
 *                   proxy URL via the parent MultiServerMCPClient instead.
 *
 * @example
 * ```ts
 * import { createFinanceTools } from "langchain-toolstem/finance";
 *
 * const tools = await createFinanceTools({ apifyToken: process.env.APIFY_TOKEN });
 * ```
 */

import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import type { StructuredTool } from "@langchain/core/tools";
import type { ToolstemClientOptions } from "./types.js";

const FINANCE_URL = "https://mcp.toolstem.com/mcp/finance";

/**
 * Create LangChain StructuredTool instances for the Toolstem Finance MCP server.
 *
 * @param opts.apifyToken  Apify API token for simple auth (no wallet required).
 * @param opts.headers     Extra headers merged with auth header (if any).
 * @returns Array of LangChain StructuredTool instances ready to pass to an agent.
 */
export async function createFinanceTools(
  opts: ToolstemClientOptions = {}
): Promise<StructuredTool[]> {
  const { apifyToken, headers: extraHeaders = {} } = opts;

  const headers: Record<string, string> = { ...extraHeaders };
  if (apifyToken) {
    headers["Authorization"] = `Bearer ${apifyToken}`;
  }

  const client = new MultiServerMCPClient({
    toolstem_finance: {
      transport: "http",
      url: FINANCE_URL,
      ...(Object.keys(headers).length > 0 ? { headers } : {}),
    },
  });

  return client.getTools() as Promise<StructuredTool[]>;
}
