/**
 * x402 USDC payment helper for Toolstem MCP servers.
 *
 * Toolstem's hosted MCP endpoint (mcp.toolstem.com) replies HTTP 402 to tools/call
 * requests, expecting the caller to sign an EIP-3009 USDC transferWithAuthorization
 * payload and retry with the X-PAYMENT / PAYMENT-SIGNATURE header. This module
 * builds a fetch-compatible function that handles that loop transparently using
 * @x402/core + @x402/evm directly (matching the toolstem-proxy e2e wire format).
 *
 * Two surface shapes:
 *   - `createX402Fetch(opts)` -> Promise<typeof fetch>
 *       Drop-in fetch replacement. Pass it to MCP transports that accept a
 *       custom `fetch` (e.g. via `createFinanceTools({ fetch: payingFetch })`).
 *
 *   - `createX402Proxy(opts)` -> Promise<{ url, close }>
 *       Convenience wrapper: a local HTTP reverse proxy that uses the paying
 *       fetch internally and forwards to mcp.toolstem.com. Useful for clients
 *       that only accept a plain http:// URL.
 *
 * Requires optional dependencies:
 *   npm install viem @x402/core @x402/evm
 *
 * @example
 * ```ts
 * import { createFinanceTools } from "langchain-toolstem/finance";
 * import { createX402Fetch } from "langchain-toolstem/x402";
 *
 * const payingFetch = await createX402Fetch({
 *   privateKey: process.env.X402_PRIVATE_KEY!,
 * });
 *
 * const financeTools = await createFinanceTools({ fetch: payingFetch });
 * ```
 */

import { createServer } from "node:http";
import type {
  X402FetchOptions,
  X402ProxyHandle,
  X402ProxyOptions,
} from "./types.js";

const DEFAULT_UPSTREAM = "https://mcp.toolstem.com";
const DEFAULT_PORT = 4021;
const DEFAULT_MAX_PAYMENT_USD = 1.0;

/**
 * Build a fetch-compatible function that auto-handles HTTP 402 by signing an
 * EIP-3009 USDC payment per the @x402/core spec and re-issuing the original
 * request with the PAYMENT-SIGNATURE / X-PAYMENT header.
 *
 * @param opts.privateKey      Base-mainnet wallet private key (0x-prefixed hex).
 * @param opts.maxPaymentUsd   Auto-approve payments up to this USD amount per call. Defaults to 1.0.
 */
export async function createX402Fetch(
  opts: X402FetchOptions
): Promise<typeof fetch> {
  // Dynamic imports so these stay optional deps.
  let privateKeyToAccount: (pk: `0x${string}`) => unknown;
  let X402Client: new (...args: unknown[]) => unknown;
  let x402HTTPClient: new (client: unknown) => {
    getPaymentRequiredResponse: (
      getHeader: (name: string) => string | null | undefined,
      body?: unknown
    ) => unknown;
    createPaymentPayload: (paymentRequired: unknown) => Promise<unknown>;
    encodePaymentSignatureHeader: (payload: unknown) => Record<string, string>;
  };
  let registerExactEvmScheme: (client: unknown, config: unknown) => unknown;

  try {
    const accounts = await import("viem/accounts");
    privateKeyToAccount = accounts.privateKeyToAccount as never;
  } catch {
    throw new Error(
      "install peer deps to use the x402 path: npm install viem @x402/core @x402/evm"
    );
  }

  try {
    const core = await import("@x402/core/client");
    X402Client = core.x402Client as never;
    x402HTTPClient = core.x402HTTPClient as never;
  } catch {
    throw new Error(
      "install peer deps to use the x402 path: npm install viem @x402/core @x402/evm"
    );
  }

  try {
    const evm = await import("@x402/evm/exact/client");
    registerExactEvmScheme = evm.registerExactEvmScheme as never;
  } catch {
    throw new Error(
      "install peer deps to use the x402 path: npm install viem @x402/core @x402/evm"
    );
  }

  const { privateKey, maxPaymentUsd = DEFAULT_MAX_PAYMENT_USD } = opts;

  const pk: `0x${string}` = privateKey.startsWith("0x")
    ? (privateKey as `0x${string}`)
    : (`0x${privateKey}` as `0x${string}`);
  const account = privateKeyToAccount(pk);
  const maxAtomic = BigInt(Math.floor(maxPaymentUsd * 1_000_000));

  const core = new (X402Client as never as { new (): { registerPolicy: (p: unknown) => unknown } })();
  registerExactEvmScheme(core, { signer: account });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (core as any).registerPolicy(
    (_v: number, reqs: Array<{ amount: string }>) =>
      reqs.filter((r) => {
        try {
          return BigInt(r.amount) <= maxAtomic;
        } catch {
          return false;
        }
      })
  );
  const http = new x402HTTPClient(core);

  const payingFetch: typeof fetch = async (input, init) => {
    const baseFetch = globalThis.fetch;
    const first = await baseFetch(input as RequestInfo, init);
    if (first.status !== 402) return first;

    const getHeader = (name: string) => first.headers.get(name);

    let bodyForV1: unknown;
    try {
      bodyForV1 = await first.clone().json();
    } catch {
      bodyForV1 = undefined;
    }

    const paymentRequired = http.getPaymentRequiredResponse(getHeader, bodyForV1);
    const paymentPayload = await http.createPaymentPayload(paymentRequired);
    const paymentHeaders = http.encodePaymentSignatureHeader(paymentPayload);

    const retryHeaders = new Headers(init?.headers as HeadersInit | undefined);
    for (const [k, v] of Object.entries(paymentHeaders)) {
      retryHeaders.set(k, v);
    }

    return baseFetch(input as RequestInfo, {
      ...(init ?? {}),
      headers: retryHeaders,
    });
  };

  return payingFetch;
}

/**
 * Start a local HTTP reverse proxy that wraps the paying fetch from
 * `createX402Fetch`. Useful when an MCP client only accepts a plain http:// URL.
 *
 * @param opts.privateKey     Base-mainnet wallet private key (0x-prefixed hex).
 * @param opts.port           Local port to bind. Defaults to 4021.
 * @param opts.maxPaymentUsd  Auto-approve payments up to this USD amount per call. Defaults to 1.0.
 * @param opts.upstream       Upstream MCP host. Defaults to "https://mcp.toolstem.com".
 */
export async function createX402Proxy(
  opts: X402ProxyOptions
): Promise<X402ProxyHandle> {
  const {
    privateKey,
    port = DEFAULT_PORT,
    host = '127.0.0.1',
    maxPaymentUsd = DEFAULT_MAX_PAYMENT_USD,
    upstream = DEFAULT_UPSTREAM,
  } = opts;

  const payingFetch = await createX402Fetch({ privateKey, maxPaymentUsd });

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

      const upstreamResp = await payingFetch(upstreamUrl, {
        method: req.method,
        headers,
        body:
          body && req.method !== "GET" && req.method !== "HEAD"
            ? body
            : undefined,
      });

      res.statusCode = upstreamResp.status;
      upstreamResp.headers.forEach((v, k) => {
        if (["transfer-encoding", "connection"].includes(k.toLowerCase())) return;
        res.setHeader(k, v);
      });
      const buf = Buffer.from(await upstreamResp.arrayBuffer());
      res.end(buf);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[x402-proxy]", msg);
      res.statusCode = 502;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "x402_proxy_failure", message: msg }));
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      console.log(`[x402-proxy] listening on http://${host}:${port}`);
      console.log(`[x402-proxy] forwarding -> ${upstream}`);
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
