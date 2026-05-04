/**
 * Shared types for langchain-toolstem.
 */

/** Options for creating Toolstem MCP tool sets. */
export interface ToolstemClientOptions {
  /** Apify API token for authentication. If omitted, the server will require x402 payment. */
  apifyToken?: string;
  /** Additional HTTP headers to include in every MCP request. */
  headers?: Record<string, string>;
}

/** Result of createX402Proxy — a running local reverse proxy. */
export interface X402ProxyHandle {
  /** The base URL of the local proxy (e.g. "http://localhost:4021"). */
  url: string;
  /** Gracefully stop the proxy server. */
  close: () => Promise<void>;
}

/** Options for createX402Proxy. */
export interface X402ProxyOptions {
  /** Base-mainnet private key (0x-prefixed hex). Fund with at least $0.10 USDC. */
  privateKey: string;
  /** Local port to listen on. Defaults to 4021. */
  port?: number;
  /** Maximum auto-approved payment per call in USD. Defaults to 1.0. */
  maxPaymentUsd?: number;
  /** Upstream MCP host. Defaults to "https://mcp.toolstem.com". */
  upstream?: string;
}
