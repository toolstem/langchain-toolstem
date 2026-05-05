/**
 * Live paid tools/call integration test (manual / paid).
 *
 * Skipped unless TOOLSTEM_LIVE_PAID=1 and X402_PRIVATE_KEY are set in env.
 * Funds required: Base mainnet wallet with ≥ 0.10 USDC and a few cents of ETH
 * for L2 gas. Each invocation costs 0.01 USDC.
 *
 * Run:
 *   TOOLSTEM_LIVE_PAID=1 X402_PRIVATE_KEY=0x... node --test __tests__/paid-call.live.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createFinanceTools } from "../dist/finance.js";
import { createX402Fetch } from "../dist/x402.js";

const enabled =
  process.env.TOOLSTEM_LIVE_PAID === "1" && !!process.env.X402_PRIVATE_KEY;

test(
  "paid tools/call: get_stock_snapshot AAPL",
  { skip: !enabled && "set TOOLSTEM_LIVE_PAID=1 and X402_PRIVATE_KEY to run" },
  async () => {
    const fetchPay = await createX402Fetch({
      privateKey: process.env.X402_PRIVATE_KEY!,
    });
    const tools = await createFinanceTools({ fetch: fetchPay });
    const snapshot = tools.find((t) => t.name === "get_stock_snapshot");
    assert.ok(snapshot, "get_stock_snapshot missing");
    const result = await snapshot.invoke({ symbol: "AAPL" });
    assert.ok(result, "no result returned");
  }
);
