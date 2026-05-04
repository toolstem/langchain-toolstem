/**
 * x402 reverse proxy for Toolstem MCP servers.
 *
 * Why this exists:
 *   @langchain/mcp-adapters connects to MCP servers over plain HTTP and does
 *   not accept a custom fetch implementation. Toolstem's hosted MCP endpoint
 *   replies with HTTP 402 to request USDC micropayment. To bridge the two, this
 *   module starts a tiny local HTTP reverse proxy that wraps fetch with
 *   x402-fetch, signs USDC payments from an Ethereum wallet (Base mainnet),
 *   and forwards transparently to mcp.toolstem.com.
 *
 *   LangChain points at http://localhost:<port>/mcp/finance (or /mcp/sec) instead
 *   of https://mcp.toolstem.com/mcp/finance — same MCP protocol, payment handled
 *   transparently.
 *
 * Requires optional dependencies: viem, x402-fetch
 *   npm install viem x402-fetch
 *
 * @example
 * ```ts
 * import { createX402Proxy } from "langchain-toolstem/x402";
 * import { createFinanceTools } from "langchain-toolstem/finance";
 * import { MultiServerMCPClient } from "@langchain/mcp-adapters";
 *
 * const proxy = await createX402Proxy({ privateKey: process.env.X402_PRIVATE_KEY! });
 *
 * const client = new MultiServerMCPClient({
 *   toolstem_finance: { transport: "http", url: `${proxy.url}/mcp/finance` },
 *   toolstem_sec:     { transport: "http", url: `${proxy.url}/mcp/sec` },
 * });
 * const tools = await client.getTools();
 *
 * // ... run agent ...
 *
 * await client.close();
 * await proxy.close();
 * ```
 */

import { createServer } from "node:http";
import type { X402ProxyHandle, X402ProxyOptions } from "./types.js";

const DEFAULT_PORT = 4021;
const DEFAULT_UPSTREAM = "https://mcp.toolstem.com";
const DEFAULT_MAX_PAYMENT_USD = 1.0;

/**
 * Start a local HTTP reverse proxy that wraps outbound requests with x402-fetch
 * so LangChain's MCP adapter can reach Toolstem without implementing x402 itself.
 *
 * @param opts.privateKey     Base-mainnet wallet private key (0x-prefixed hex).
 *                            Fund with at least $0.10 USDC before use.
 * @param opts.port           Local port to bind. Defaults to 4021.
 * @param opts.maxPaymentUsd  Auto-approve payments up to this USD amount per call. Defaults to 1.0.
 * @param opts.upstream       Upstream MCP host. Defaults to "https://mcp.toolstem.com".
 * @returns Promise resolving to { url, close } once the server is listening.
 */
export async function createX402Proxy(
  opts: X402ProxyOptions
): Promise<X402ProxyHandle> {
  // Guard: dynamic import of optional deps with a friendly error.
  let privateKeyToAccount: (pk: `0x${string}`) => { address: string };
  let wrapFetchWithPayment: (
    f: typeof fetch,
    account: { address: string },
    maxAtomic: bigint
  ) => typeof fetch;

  try {
    const viemAccounts = await import("viem/accounts");
    privateKeyToAccount = viemAccounts.privateKeyToAccount as typeof privateKeyToAccount;
  } catch {
    throw new Error(
      "install viem and x402-fetch to use the x402 path: npm install viem x402-fetch"
    );
  }

  try {
    const x402Module = await import("x402-fetch");
    wrapFetchWithPayment = x402Module.wrapFetchWithPayment as typeof wrapFetchWithPayment;
  } catch {
    throw new Error(
      "install viem and x402-fetch to use the x402 path: npm install viem x402-fetch"
    );
  }

  const {
    privateKey,
    port = DEFAULT_PORT,
    maxPaymentUsd = DEFAULT_MAX_PAYMENT_USD,
    upstream = DEFAULT_UPSTREAM,
  } = opts;

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const maxAtomic = BigInt(Math.floor(maxPaymentUsd * 1_000_000));
  const fetchWithPay = wrapFetchWithPayment(fetch, account, maxAtomic);

  const server = createServer(async (req, res) => {
    try {
      const upstreamUrl = `${upstream}${req.url ?? "/"}`;
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(req.headers)) {
        if (["host", "connection", "content-length"].includes(k.toLowerCase()))
          continue;
        if (typeof v === "string") headers[k] = v;
        else if (Array.isArray(v)) headers[k] = v.join(", ");
      }

      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      const body = chunks.length ? Buffer.concat(chunks) : undefined;

      const upstreamResp = await fetchWithPay(upstreamUrl, {
        method: req.method,
        headers,
        body:
          body && req.method !== "GET" && req.method !== "HEAD"
            ? body
            : undefined,
      });

      res.statusCode = upstreamResp.status;
      upstreamResp.headers.forEach((v, k) => {
        if (["transfer-encoding", "connection"].includes(k.toLowerCase()))
          return;
        res.setHeader(k, v);
      });
      const buf = Buffer.from(await upstreamResp.arrayBuffer());
      res.end(buf);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : String(err);
      console.error("[x402-proxy]", msg);
      res.statusCode = 502;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({ error: "x402_proxy_failure", message: msg })
      );
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, () => {
      console.log(`[x402-proxy] listening on http://localhost:${port}`);
      console.log(`[x402-proxy] forwarding -> ${upstream}`);
      console.log(
        `[x402-proxy] wallet ${account.address} (max $${maxPaymentUsd}/call)`
      );
      resolve();
    });
  });

  return {
    url: `http://localhost:${port}`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve()))
      ),
  };
}
