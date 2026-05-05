/**
 * Live MCP discovery integration test.
 *
 * Calls the public Toolstem MCP endpoints (initialize + tools/list — both
 * free, no payment required) and asserts the exact tool names exposed by the
 * Finance and SEC servers.
 *
 * Run after `npm run build`:
 *   node --test __tests__/discovery.live.test.js
 *
 * The test imports the compiled JS so it runs without a TypeScript loader.
 * Force-exits at the end because the underlying MCP SSE transport keeps an
 * open handle that node:test's runner does not close on its own.
 *
 * `tools/call` requires a funded Base mainnet wallet and is exercised in
 * `paid-call.live.test.js` (skipped by default).
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createFinanceTools } from "../dist/finance.js";
import { createSecTools } from "../dist/sec.js";

const FINANCE_EXPECTED = [
  "compare_companies",
  "get_company_metrics",
  "get_stock_snapshot",
];

const SEC_EXPECTED = [
  "compare_disclosure_signals",
  "get_company_filings_summary",
  "get_insider_signal",
  "get_institutional_signal",
  "get_material_events_digest",
];

test("finance MCP exposes exactly the 3 ground-truth tools", async () => {
  const tools = await createFinanceTools();
  const names = tools.map((t) => t.name).sort();
  assert.equal(tools.length, 3, `expected 3 finance tools, got ${tools.length}`);
  assert.deepEqual(names, FINANCE_EXPECTED, `finance names: ${names.join(", ")}`);
  for (const t of tools) {
    assert.ok(typeof t.description === "string" && t.description.length > 0);
    assert.ok(t.schema, `${t.name} missing schema`);
  }
});

test("SEC MCP exposes exactly the 5 ground-truth tools", async () => {
  const tools = await createSecTools();
  const names = tools.map((t) => t.name).sort();
  assert.equal(tools.length, 5, `expected 5 SEC tools, got ${tools.length}`);
  assert.deepEqual(names, SEC_EXPECTED, `SEC names: ${names.join(", ")}`);
  for (const t of tools) {
    assert.ok(typeof t.description === "string" && t.description.length > 0);
    assert.ok(t.schema, `${t.name} missing schema`);
  }
});

after(() => {
  // MCP SSE transports keep open sockets that node:test does not close.
  setImmediate(() => process.exit(0));
});
