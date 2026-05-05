/**
 * Shared types for langchain-toolstem.
 */

/** Options for createFinanceTools / createSecTools. */
export interface ToolstemClientOptions {
  /**
   * Custom fetch implementation. Pass the result of `createX402Fetch` to make
   * tools/call requests transparently sign and pay USDC. Falls back to the
   * global `fetch` if omitted (only `initialize` and `tools/list` will work
   * without payment).
   */
  fetch?: typeof fetch;
  /** Additional HTTP headers to include in every MCP request. */
  headers?: Record<string, string>;
  /** Override the upstream MCP URL. Defaults to the public Toolstem endpoint. */
  url?: string;
}

/** Options for createX402Fetch. */
export interface X402FetchOptions {
  /** Base-mainnet private key (0x-prefixed hex). Fund with at least 0.10 USDC. */
  privateKey: string;
  /** Maximum auto-approved payment per call in USD. Defaults to 1.0. */
  maxPaymentUsd?: number;
}

/** Result of createX402Proxy — a running local reverse proxy. */
export interface X402ProxyHandle {
  /** The base URL of the local proxy (e.g. "http://localhost:4021"). */
  url: string;
  /** Gracefully stop the proxy server. */
  close: () => Promise<void>;
}

/** Options for createX402Proxy. */
export interface X402ProxyOptions extends X402FetchOptions {
  /** Local port to listen on. Defaults to 4021. */
  port?: number;
  /** Upstream MCP host. Defaults to "https://mcp.toolstem.com". */
  upstream?: string;
}
