import assert from "node:assert/strict";
import test from "node:test";
import { INDEXES } from "../config.js";
import { buildQuotePayload } from "../services/quoteService.js";

const latest = Date.UTC(2026, 10, 3, 20, 55);
const env = { NasdaqDashboard: {
  async get(keys) {
    const value = (key) => JSON.stringify({ symbol: key.slice(7), tickerId: 1, iconLight: "https://example.test/icon.svg" });
    return Array.isArray(keys) ? new Map(keys.map((key) => [key, value(key)])) : value(keys);
  },
  async put() {},
} };

function mockYahoo(t, intraday = [100, 102, 103]) {
  const requests = [];
  t.mock.method(Date, "now", () => latest + 5 * 60000);
  t.mock.method(globalThis, "fetch", async (input) => {
    const url = new URL(input);
    requests.push(url);
    assert.equal(url.hostname, "query1.finance.yahoo.com");
    const oneDay = url.searchParams.get("range") === "1d";
    const values = oneDay ? intraday : [50, 75, 90];
    const timestamp = oneDay
      ? values.map((_, i) => (latest - (values.length - 1 - i) * 5 * 60000) / 1000)
      : [latest - 28 * 86400000 - 3600000, latest - 86400000, latest - 5 * 60000].map((t) => t / 1000);
    return Response.json({ chart: { error: null, result: [{
      meta: { regularMarketTime: latest / 1000, regularMarketPrice: 103, chartPreviousClose: 100,
        currentTradingPeriod: { regular: { start: Date.UTC(2026, 10, 3, 14, 30) / 1000, end: Date.UTC(2026, 10, 3, 21) / 1000 } } },
      timestamp, indicators: { quote: [{ close: values, open: values, high: values, low: values }] },
    }] } });
  });
  return requests;
}

test("daily index sparkline reuses the existing 1D requests without changing quotes", async (t) => {
  const requests = mockYahoo(t);
  const payload = await buildQuotePayload("1D", env, "yahoo");
  assert.equal(payload.items.length, INDEXES.length);
  assert.equal(requests.length, INDEXES.length);
  for (const item of payload.items) {
    assert.deepEqual(item.sparkline, [100, 102, 103]);
    assert.deepEqual(item.line.map((point) => point.close), [100, 102, 103]);
    assert.equal(item.sparklineChange, 3);
    assert.equal(item.cardBaseClose, 100);
    assert.equal(item.cardChg, 3);
    assert.equal(item.latestT, latest);
    assert.equal(item.timeValidationT, latest);
  }
});

test("long-period index cards retain the intraday sparkline and existing historical line", async (t) => {
  const requests = mockYahoo(t);
  const payload = await buildQuotePayload("1M", env, "yahoo");
  assert.equal(requests.length, INDEXES.length * 2);
  for (const item of payload.items) {
    assert.deepEqual(item.sparkline, [100, 102, 103]);
    assert.deepEqual(item.line.map((point) => point.close), [50, 75, 90]);
    assert.equal(item.sparklineChange, 3);
    assert.equal(item.cardBaseClose, 50);
    assert.equal(item.cardChg, 53);
    assert.equal(item.cardChgPct, 106);
  }
});

test("invalid intraday closes are excluded without failing other index data", async (t) => {
  mockYahoo(t, [100, null, 103]);
  const payload = await buildQuotePayload("1D", env, "yahoo");
  assert.equal(payload.items.length, INDEXES.length);
  assert.ok(payload.items.every((item) => item.sparkline.length === 2));
  assert.ok(payload.items.every((item) => item.sparkline.every(Number.isFinite)));
  assert.deepEqual(payload.failedIndexes, []);
});

test("a single cash-session bar does not invent an index sparkline", async (t) => {
  mockYahoo(t, [103]);
  const payload = await buildQuotePayload("1D", env, "yahoo");
  const cashSessionIndex = payload.items.find((item) => item.symbol === "MSCIUSA50");
  assert.equal(cashSessionIndex.sparkline, null);
  assert.equal(cashSessionIndex.line.length, 1);
  assert.equal(cashSessionIndex.lastClose, 103);
  assert.equal(payload.items.length, INDEXES.length);
});
