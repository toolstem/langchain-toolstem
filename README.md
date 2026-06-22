# langchain-toolstem

[![npm version](https://img.shields.io/npm/v/langchain-toolstem)](https://www.npmjs.com/package/langchain-toolstem)
[![npm downloads](https://img.shields.io/npm/dw/langchain-toolstem)](https://www.npmjs.com/package/langchain-toolstem)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

LangChain.js tools wrapping [Toolstem](https://toolstem.com) MCP servers.

## What this does

`langchain-toolstem` wraps both Toolstem MCP servers — **Finance** and **SEC EDGAR** — as native LangChain tools and handles x402 payment automatically. Pass a funded Base mainnet wallet key and every `tools/call` is paid per-call in USDC via EIP-3009; there are no API keys, subscriptions, or invoices. Tool names and schemas are discovered live via MCP `tools/list`, so new Toolstem tools appear without a library upgrade.

Two MCP servers — **Finance** and **SEC EDGAR** — exposed as native
LangChain tools you can drop straight into any LangChain / LangGraph agent. Tool
names and JSON Schemas are discovered live via standard MCP `tools/list` — no
hardcoded definitions.

By default these helpers connect to the **hosted Toolstem endpoints** at
`https://mcp.toolstem.com/mcp/finance` and `https://mcp.toolstem.com/mcp/sec`.
**No API key, no infra, no setup** — you don't run a server or bring an upstream
data key. Calls are billed per-call via x402 (USDC on Base mainnet) straight from
the agent's wallet.

```
Finance — 3 tools                 SEC EDGAR — 5 tools
─────────────────                 ───────────────────
get_stock_snapshot                get_company_filings_summary
get_company_metrics               get_insider_signal
compare_companies                 get_institutional_signal
                                  get_material_events_digest
                                  compare_disclosure_signals
```

---

## Wallet prerequisite

> **These helpers require a funded Base mainnet USDC wallet.** Each `tools/call`
> is billed per-call via x402 / EIP-3009 `transferWithAuthorization`.
> `initialize` and `tools/list` are **free**, so you can discover the tool
> catalog without a wallet — but agent invocations will return HTTP 402 until
> a payment header is signed.

Per-call pricing (paid in USDC on Base mainnet):

- **Finance** — **$0.01** per `tools/call`.
- **SEC EDGAR** — tiered by tool: **$0.005** (`get_company_filings_summary`),
  **$0.05** (`get_insider_signal`, `get_institutional_signal`), **$0.50**
  (`get_material_events_digest`, `compare_disclosure_signals`).

Fund the wallet you'll sign with:

- enough USDC on Base mainnet to cover your expected call volume at the prices
  above, plus headroom (the per-call `maxPaymentUsd` cap defaults to 1.00)
- a few cents of ETH on Base for L2 gas (signing is gasless via EIP-3009, but the
  facilitator settlement transaction still needs gas)

Bridge USDC to Base from any major exchange or via [Coinbase Onramp](https://www.coinbase.com/onramp).

---

## Install

```bash
npm install langchain-toolstem @langchain/core
# x402 payment path requires:
npm install viem @x402/core @x402/evm
```

---

## Quick start — Finance

```ts
import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { createFinanceTools } from "langchain-toolstem/finance";
import { createX402Fetch } from "langchain-toolstem/x402";

// 1. Build a fetch that auto-signs USDC payments on HTTP 402.
const fetchPay = await createX402Fetch({
  privateKey: process.env.X402_PRIVATE_KEY!, // 0x-prefixed Base mainnet private key
  maxPaymentUsd: 0.05,                       // safety cap per call (default: 1.00)
});

// 2. Discover the 3 Finance tools (initialize + tools/list, free).
const tools = await createFinanceTools({ fetch: fetchPay });

const agent = createReactAgent({
  llm: new ChatOpenAI({ model: "gpt-4o-mini", temperature: 0 }),
  tools,
});

// 3. Invocations route through the paying fetch — each tools/call = 0.01 USDC.
const result = await agent.invoke({
  messages: [
    { role: "user", content: "Compare AAPL, MSFT, and GOOGL on P/E, growth, and margins." },
  ],
});

console.log(result.messages.at(-1)?.content);
```

---

## Quick start — SEC EDGAR

```ts
import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { createSecTools } from "langchain-toolstem/sec";
import { createX402Fetch } from "langchain-toolstem/x402";

const fetchPay = await createX402Fetch({ privateKey: process.env.X402_PRIVATE_KEY! });
const tools = await createSecTools({ fetch: fetchPay });

const agent = createReactAgent({
  llm: new ChatOpenAI({ model: "gpt-4o-mini", temperature: 0 }),
  tools,
});

const result = await agent.invoke({
  messages: [
    {
      role: "user",
      content:
        "Has TSLA had any material 8-K events in the last 90 days? Also flag any insider Form 4 activity.",
    },
  ],
});
```

---

## Quick start — Finance + SEC in one agent

Load both tool sets and hand them to a single agent. The same paying fetch covers every call across both servers:

```ts
import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { createFinanceTools } from "langchain-toolstem/finance";
import { createSecTools } from "langchain-toolstem/sec";
import { createX402Fetch } from "langchain-toolstem/x402";

// One paying fetch, shared across both servers.
const fetchPay = await createX402Fetch({ privateKey: process.env.X402_PRIVATE_KEY! });

// Discover Finance (3 tools) + SEC EDGAR (5 tools) and merge them.
const tools = [
  ...(await createFinanceTools({ fetch: fetchPay })),
  ...(await createSecTools({ fetch: fetchPay })),
];

const agent = createReactAgent({
  llm: new ChatOpenAI({ model: "gpt-4o-mini", temperature: 0 }),
  tools,
});

const result = await agent.invoke({
  messages: [
    {
      role: "user",
      content:
        "Give me a snapshot of NVDA (Finance) and flag any material 8-K events it filed in the last 90 days (SEC).",
    },
  ],
});

console.log(result.messages.at(-1)?.content);
// The agent calls get_stock_snapshot (Finance, $0.01) and
// get_material_events_digest (SEC, $0.50) — each auto-paid in USDC via x402.
```

---

## Pricing summary

Per-call, paid in USDC on Base mainnet via x402:

- **Finance** — $0.01 per `tools/call`. Full table: [toolstem-mcp-server README](https://github.com/toolstem/toolstem-mcp-server#pricing).
- **SEC EDGAR** — tiered $0.005–$0.50 per `tools/call`. Full table: [toolstem-sec-mcp-server README](https://github.com/toolstem/toolstem-sec-mcp-server#pricing).

`initialize` and `tools/list` are always free. Try the tools live in the [Toolstem playground](https://www.toolstem.com/playground/).

---

## Minimal viem wallet setup

If you don't already have a wallet, generate one with `viem`:

```ts
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const privateKey = generatePrivateKey();        // SAVE THIS — it's your wallet key
const account = privateKeyToAccount(privateKey);
console.log("Address:", account.address);       // fund this address on Base mainnet
console.log("Private key:", privateKey);        // pass to createX402Fetch / createX402Proxy
```

⚠️ **Treat the private key like a credit card number.** Anyone with it can spend
your Base USDC and ETH. Store it in a secret manager (1Password, AWS Secrets
Manager, Vercel env vars), never commit it.

---

## API

### `createX402Fetch(opts)` → `Promise<typeof fetch>`

Returns a fetch-compatible function that:

1. Issues the request normally.
2. On HTTP 402, parses `payment-required` (base64-encoded `PaymentRequired`) per
   the x402 v2 wire format.
3. Signs an EIP-3009 USDC `transferWithAuthorization` for the selected
   requirement using `@x402/evm` (Base mainnet, scheme `exact`).
4. Re-issues the original request with the `PAYMENT-SIGNATURE` header.

```ts
type X402FetchOptions = {
  privateKey: string;       // 0x-prefixed Base mainnet private key
  maxPaymentUsd?: number;   // safety cap per call, defaults to 1.0
};
```

### `createFinanceTools(opts?)` / `createSecTools(opts?)` → `Promise<DynamicStructuredTool[]>`

```ts
type ToolstemClientOptions = {
  fetch?: typeof fetch;            // pass createX402Fetch result for paid calls
  headers?: Record<string, string>; // extra HTTP headers
  url?: string;                    // override the upstream MCP endpoint
};
```

Both helpers run standard MCP `initialize` + `tools/list` against
`https://mcp.toolstem.com/mcp/finance` or `/mcp/sec` and return the discovered
tools. **No tool names are hardcoded** — if Toolstem ships a new tool tomorrow,
your agent picks it up on the next process restart.

### `createX402Proxy(opts)` → `Promise<{ url, close }>`

Convenience wrapper for environments that can only point at a plain `http://`
URL (e.g. the high-level `MultiServerMCPClient` from `@langchain/mcp-adapters`,
which does not currently accept a custom fetch). Spawns a local reverse proxy
that wraps `createX402Fetch` and forwards to `mcp.toolstem.com`.

```ts
const proxy = await createX402Proxy({ privateKey: process.env.X402_PRIVATE_KEY! });
// → http://localhost:4021
// Point any MCP client at `${proxy.url}/mcp/finance` or `${proxy.url}/mcp/sec`.
await proxy.close();
```

> **Security note:** The proxy binds `127.0.0.1` (localhost) by default. If you
> need network-wide access, pass `host: '0.0.0.0'` — but ensure the machine is
> behind a firewall or VPN, as the proxy holds your wallet signing key in memory.

---

## Discovery without payment

`initialize` and `tools/list` are unmetered — useful for static catalogs, prompt
debugging, or CI smoke tests.

```ts
import { createFinanceTools } from "langchain-toolstem/finance";

const tools = await createFinanceTools(); // no fetch override → free discovery
console.log(tools.map((t) => t.name));
// → [ 'get_stock_snapshot', 'get_company_metrics', 'compare_companies' ]
```

The library ships an integration test (`__tests__/discovery.live.test.ts`) that
hits live `mcp.toolstem.com` and asserts these exact 3 finance + 5 SEC names.

```bash
npm run test:live
```

---

## Networks

- **Base mainnet** (`eip155:8453`) — production. USDC contract
  `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`. Toolstem's facilitator settles
  to `0xB009DA692cF3EFf7567bF727b8B2F3b5BFc3383E`.

The default `createX402Fetch` registers the EVM exact scheme and accepts any
`eip155:*` requirement returned by the server.

---

## Why a paying fetch instead of an MCP middleware?

`@langchain/mcp-adapters`' `MultiServerMCPClient` does not currently accept a
custom `fetch`, but the underlying `StreamableHTTPClientTransport` from
`@modelcontextprotocol/sdk` does. This package wires the two together: the MCP
SDK transport is constructed directly with the paying fetch, then handed to
`loadMcpTools` for LangChain conversion. That way the request/response loop is
plain HTTP-with-payment-headers — no extra hops, no protocol drift.

---

## Python

Python users: see [`langchain-toolstem`](https://pypi.org/project/langchain-toolstem/) on PyPI for the equivalent helpers.

---

## License

MIT — © Toolstem
