import assert from "node:assert/strict";
import test from "node:test";
import { buildCommonIndexWeightsPayload, buildIndexWeightsPayload } from "../services/indexWeightsService.js";

const codes = ["NDXTMC", "SP500-45", "NDX"];
const env = { NasdaqDashboard: {
  async get(keys) {
    return new Map(keys.map((key) => [key, JSON.stringify({
      symbol: key.slice(7), nameEn: key.slice(7), iconLight: "https://example.test/icon.svg",
    })]));
  },
  async put() {},
} };

function mockHoldings(t) {
  const requests = [];
  t.mock.method(globalThis, "fetch", async (input) => {
    const url = new URL(input);
    requests.push(url);
    if (url.hostname === "reportdocs.static.szse.cn") {
      return new Response([
        "159900  CASH  1  0  1000  0  0",
        "NVDA  NVIDIA  10  0  200  0  0",
        "AAPL  APPLE  10  0  100  0  0",
        "TECHONLY  TECH  10  0  50  0  0",
      ].join("\n"));
    }
    const product = url.searchParams.get("portfolioId");
    assert.ok(["253741", "280510"].includes(product), `Unexpected holding source: ${url}`);
    const tech = product === "280510";
    return Response.json({ componentsByNameMap: { holdings: { containersByNameMap: { all: { dataPointsByNameMap: {
      asOfDate: { value: "20261029" },
      ticker: { value: ["NVDA", "AAPL", tech ? "ORCL" : "AMZN"] },
      assetClass: { value: ["Equity", "Equity", "Equity"] },
      holdingPercent: { value: tech ? [8, 6, 3] : [10, 8, 5] },
    } } } } } });
  });
  return requests;
}

test("common holdings use only the three technology indexes and recompute totals", async (t) => {
  const requests = mockHoldings(t);
  const payload = await buildCommonIndexWeightsPayload(env);
  assert.deepEqual(payload.indexCodes, codes);
  assert.deepEqual(payload.indexes.map((index) => index.indexCode), codes);
  assert.deepEqual(payload.items.map((item) => item.symbol), ["NVDA", "AAPL"]);
  assert.deepEqual(payload.items[0].weights, { NDXTMC: 20, "SP500-45": 8, NDX: 10 });
  assert.equal(payload.items[0].totalWeightPct, 38);
  assert.equal(payload.items[0].averageWeightPct, 38 / 3);
  assert.equal(payload.items[1].totalWeightPct, 24);
  assert.equal(requests.length, 3);
  assert.ok(requests.every((url) => !url.href.includes("239726")));
});

test("each retained index remains available", async (t) => {
  mockHoldings(t);
  for (const code of codes) {
    const payload = await buildIndexWeightsPayload(code, env);
    assert.equal(payload.ok, true);
    assert.equal(payload.indexCode, code);
    assert.equal(payload.items.length, 3);
    assert.ok(payload.items.every((item, i, items) => !i || items[i - 1].weightPct >= item.weightPct));
  }
});

test("removed S&P 500 weights no longer make an upstream request", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => { throw new Error("Unexpected fetch"); });
  await assert.rejects(buildIndexWeightsPayload("SP500", env), /Unsupported index code: SP500/);
  assert.equal(fetch.mock.callCount(), 0);
});
