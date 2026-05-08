# Changelog

All notable changes to `langchain-toolstem` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.3] - 2026-05-08

### Security
- `createX402Proxy` now binds `127.0.0.1` by default instead of `0.0.0.0`. This prevents accidental exposure of the wallet signing proxy on public networks.
- New optional `host` parameter on `X402ProxyOptions` for users who explicitly need network-wide binding.

## [0.1.2] - 2026-05-05

### Fixed
- **Replaced broken `x402-fetch@1.2.0` wire format with `@x402/core` + `@x402/evm`
  directly.** The previous helpers built payment headers in a format the
  Toolstem proxy would not accept, so every paid `tools/call` 402-looped. The
  new `createX402Fetch` mirrors the wire format used by the `toolstem-proxy`
  e2e test: parse `payment-required` (x402 v2 base64 header), sign EIP-3009
  `transferWithAuthorization`, retry with `PAYMENT-SIGNATURE`.
- **`createFinanceTools` / `createSecTools` now do real MCP discovery.** They
  run standard `initialize` + `tools/list` against `mcp.toolstem.com` and
  expose whatever tools the server returns — **no hardcoded tool lists**.
  The previous helpers exported the wrong names (e.g. `get_insider_signals` vs
  the actual `get_insider_signal`, `get_filings_summary` vs
  `get_company_filings_summary`). Verified live: 3 Finance tools and 5 SEC
  tools match the ground-truth schema.
- **Schema parser issue: gone.** The proxy now synthesizes clean JSON Schema
  from `toolstem-proxy/src/tool-defs.ts`, so `@langchain/mcp-adapters@^1.1.3`
  parses the `inputSchema` cleanly with no post-processing required.

### Added
- `createX402Fetch(opts)` — primary surface. Returns a fetch-compatible
  function that handles 402 → sign → retry transparently.
- `createX402Proxy(opts)` — convenience wrapper that wraps `createX402Fetch`
  in a local HTTP reverse proxy for clients that can only consume an http:// URL.
- `__tests__/discovery.live.test.ts` — hits live `mcp.toolstem.com`, asserts
  the exact 3-tool Finance and 5-tool SEC catalogs.
- `__tests__/paid-call.live.test.ts` — opt-in (TOOLSTEM_LIVE_PAID=1) test that
  exercises a paid `tools/call` end-to-end.
- npm scripts: `test:live`, `test:paid`.

### Removed
- `apifyToken` auth path — the live proxy gates everything behind x402, there
  is no Apify-token shortcut.
- `x402-fetch` dependency — replaced by `@x402/core` + `@x402/evm`.

### Changed
- `ToolstemClientOptions` now takes `fetch` and `url` instead of `apifyToken`.
- README: corrected tool names, removed `gpt-5.4` references (use `gpt-4o-mini`),
  removed dead `https://toolstem.com/connectors` links, added wallet
  prerequisite callout and minimal viem setup snippet.

## [0.1.1] - prior release
- Patched `@langchain/core` / mcp-adapters versions and `x402-fetch`. Helpers
  still produced the wrong wire format; superseded by 0.1.2.

## [0.1.0] - initial release
