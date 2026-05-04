# langchain-toolstem

LangChain.js tools wrapping [Toolstem](https://toolstem.com) MCP servers.

Two production-ready MCP servers — **Finance** and **SEC EDGAR** — exposed as native
`StructuredTool` instances you can drop straight into any LangChain / LangGraph agent.

Browse all available connectors in the [Toolstem Connectors Directory](https://toolstem.com/connectors).

---

## Install

```bash
npm install langchain-toolstem @langchain/core @langchain/mcp-adapters
```

---

## Authentication

Two paths — pick one:

| Path | What you need | Cost model |
|------|---------------|------------|
| **Apify token** | [Apify](https://apify.com) account + token | Subscription / usage-based |
| **x402 USDC** | Base mainnet wallet with ≥ $0.10 USDC | $0.01 per tool call |

---

## Path 1 — Apify token (simple)

```ts
import { createFinanceTools, createSecTools } from "langchain-toolstem";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";

const financeTools = await createFinanceTools({ apifyToken: process.env.APIFY_TOKEN });
const secTools     = await createSecTools({ apifyToken: process.env.APIFY_TOKEN });

const agent = createReactAgent({
  llm: new ChatOpenAI({ model: "gpt-4o-mini", temperature: 0 }),
  tools: [...financeTools, ...secTools],
});

const result = await agent.invoke({
  messages: [{
    role: "user",
    content: "Compare AAPL, MSFT, and GOOGL on P/E ratio. Then check for any recent TSLA 8-K filings.",
  }],
});

console.log(result.messages.at(-1)?.content);
```

### Import from subpath (tree-shakeable)

```ts
import { createFinanceTools } from "langchain-toolstem/finance";
import { createSecTools }     from "langchain-toolstem/sec";
```

---

## Path 2 — x402 USDC micropayments (advanced)

No Apify account needed. The agent's own wallet pays $0.01 USDC per tool call on Base mainnet.

### Additional install

```bash
npm install viem x402-fetch
```

### How it works

`@langchain/mcp-adapters` uses plain HTTP and doesn't support custom fetch.
`createX402Proxy` starts a local reverse proxy that intercepts HTTP 402 responses,
signs USDC payments from your wallet via `x402-fetch`, and forwards transparently to
`mcp.toolstem.com`. LangChain points at `http://localhost:4021/mcp/finance` — same
MCP protocol, payments handled out-of-band.

### End-to-end LangGraph ReAct agent example

```ts
import { createX402Proxy } from "langchain-toolstem/x402";
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";

// Start the local x402 proxy (Base mainnet wallet with ≥ $0.10 USDC)
const proxy = await createX402Proxy({
  privateKey: process.env.X402_PRIVATE_KEY!,   // 0x-prefixed hex key
  port: 4021,                                   // optional, default 4021
  maxPaymentUsd: 1.0,                           // max auto-approved per call
});

// Point @langchain/mcp-adapters at the proxy — transport MUST be "http"
// (not "streamable_http" — see langchain-mcp-adapters issue #322)
const client = new MultiServerMCPClient({
  toolstem_finance: {
    transport: "http",
    url: `${proxy.url}/mcp/finance`,
  },
  toolstem_sec: {
    transport: "http",
    url: `${proxy.url}/mcp/sec`,
  },
});

const tools = await client.getTools();
console.log("Loaded tools:", tools.map(t => t.name).join(", "));
// → get_stock_snapshot, get_company_metrics, compare_companies,
//   get_insider_signals, get_institutional_holdings, get_material_events,
//   get_earnings_signals, get_filings_summary

const agent = createReactAgent({
  llm: new ChatOpenAI({ model: "gpt-4o-mini", temperature: 0 }),
  tools,
});

const result = await agent.invoke({
  messages: [{
    role: "user",
    content:
      "Has TSLA disclosed any material 8-K events in the last 90 days, " +
      "and what are insiders doing? Also pull AAPL's current P/E ratio.",
  }],
});

console.log(result.messages.at(-1)?.content);

await client.close();
await proxy.close();
```

---

## Available tools

### Finance (`https://mcp.toolstem.com/mcp/finance`)

| Tool | Description |
|------|-------------|
| `get_stock_snapshot` | Real-time price, volume, daily change |
| `get_company_metrics` | P/E, EPS, market cap, revenue growth, margins |
| `compare_companies` | Side-by-side metric comparison for multiple tickers |

### SEC EDGAR (`https://mcp.toolstem.com/mcp/sec`)

| Tool | Description |
|------|-------------|
| `get_insider_signals` | Form 4 insider buy/sell signals |
| `get_institutional_holdings` | 13-F institutional position data |
| `get_material_events` | 8-K material event disclosures |
| `get_earnings_signals` | Earnings surprise and guidance signals |
| `get_filings_summary` | Aggregated EDGAR filings overview |

---

## API reference

### `createFinanceTools(opts?)`

```ts
import { createFinanceTools } from "langchain-toolstem/finance";

const tools = await createFinanceTools({
  apifyToken?: string,   // Apify API token
  headers?: Record<string, string>,  // extra HTTP headers
});
// → Promise<StructuredTool[]>
```

### `createSecTools(opts?)`

```ts
import { createSecTools } from "langchain-toolstem/sec";

const tools = await createSecTools({
  apifyToken?: string,
  headers?: Record<string, string>,
});
// → Promise<StructuredTool[]>
```

### `createX402Proxy(opts)`

```ts
import { createX402Proxy } from "langchain-toolstem/x402";

const proxy = await createX402Proxy({
  privateKey: string,       // Base mainnet 0x-prefixed private key (required)
  port?: number,            // default: 4021
  maxPaymentUsd?: number,   // default: 1.0
  upstream?: string,        // default: "https://mcp.toolstem.com"
});
// → Promise<{ url: string, close: () => Promise<void> }>

await proxy.close(); // gracefully stop the proxy
```

---

## Notes

- `transport` must be `"http"` (not `"streamable_http"`) per
  [@langchain/mcp-adapters issue #322](https://github.com/langchain-ai/langchainjs/issues/322).
- For x402 path, `viem` and `x402-fetch` are optional peer dependencies — install them separately.
- The proxy uses `privateKeyToAccount` from `viem/accounts` (a `LocalAccount`),
  not `createWalletClient`, which keeps the type surface minimal and compatible.

---

## Links

- [Toolstem](https://toolstem.com)
- [Toolstem Connectors Directory](https://toolstem.com/connectors)
- [Toolstem Finance MCP](https://mcp.toolstem.com/mcp/finance)
- [Toolstem SEC MCP](https://mcp.toolstem.com/mcp/sec)

---

## License

MIT © 2026 Toolstem
