import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import { test } from "node:test";
import { fetchUsdCnyContext } from "../services/fundPremiumService.js";

function ratesResponse(overrides = {}) {
  return {
    head: { rep_code: "200" },
    data: { currency: "USD/CNY" },
    records: [
      { date: "2026-10-19", values: ["6.7208"] },
      { date: "2026-10-16", values: ["6.7220"] },
      { date: "2026-10-15", values: ["6.7253"] },
    ],
    ...overrides,
  };
}

test("uses the official POST query and aligns FX with the overseas valuation date", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", async () => Response.json(ratesResponse()));
  const result = await fetchUsdCnyContext("2026-10-15", "2026-10-16");
  const [url, options] = fetchMock.mock.calls[0].arguments;
  const params = new URL(url).searchParams;
  assert.equal(options.method, "POST");
  assert.equal(params.get("currency"), "USD/CNY");
  assert.equal(params.get("startDate"), "2026-10-01");
  assert.equal(params.get("endDate"), "2026-10-16");
  assert.ok(params.get("_"));
  assert.equal(options.cf.cacheTtl, 0);
  assert.equal(result.navRate, 6.7253);
  assert.equal(result.tradeRate, 6.722);
  assert.equal(result.tradeDate, "2026-10-16");
  assert.equal(result.changePct, (6.722 / 6.7253 - 1) * 100);
});

for (const [name, makeResponse] of [
  ["HTTP 502", () => new Response("Bad Gateway", { status: 502 })],
  ["non-JSON response", () => new Response("<html>unavailable</html>")],
  ["empty records", () => Response.json(ratesResponse({ records: [] }))],
  ["upstream rejection", () => Response.json(ratesResponse({ head: { rep_code: "500" } }))],
]) {
  test(`retries ${name} and recovers with a fresh query`, async (t) => {
    let calls = 0;
    const urls = [];
    t.mock.method(globalThis, "fetch", async (url) => {
      urls.push(url);
      return ++calls === 1 ? makeResponse() : Response.json(ratesResponse());
    });
    const result = await fetchUsdCnyContext("2026-10-15", "2026-10-16");
    assert.equal(calls, 2);
    assert.notEqual(urls[0], urls[1]);
    assert.equal(result.tradeRate, 6.722);
  });
}

test("uses the USD/CNY column when the currency order changes", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json(ratesResponse({
    data: { currency: "EUR/CNY,USD/CNY" },
    records: [
      { date: "2026-10-16", values: ["7.5000", "6.7220"] },
      { date: "2026-10-15", values: ["7.5100", "6.7253"] },
    ],
  })));
  const result = await fetchUsdCnyContext("2026-10-15", "2026-10-16");
  assert.equal(result.navRate, 6.7253);
  assert.equal(result.tradeRate, 6.722);
});

test("uses the prior fixing for a holiday without applying a future rate", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json(ratesResponse()));
  const result = await fetchUsdCnyContext("2026-10-17", "2026-10-18");
  assert.equal(result.navDate, "2026-10-16");
  assert.equal(result.tradeDate, "2026-10-16");
  assert.equal(result.changePct, 0);
});

test("rejects invalid fixings instead of silently using an older day", async (t) => {
  for (const value of ["0", "-1", "", null, "N/A"]) {
    const fetchMock = t.mock.method(globalThis, "fetch", async () => Response.json(ratesResponse({
      records: [
        { date: "2026-10-16", values: [value] },
        { date: "2026-10-15", values: ["6.7253"] },
      ],
    })));
    await assert.rejects(fetchUsdCnyContext("2026-10-15", "2026-10-16"), /invalid USD\/CNY rate/);
    assert.equal(fetchMock.mock.callCount(), 2);
    fetchMock.mock.restore();
  }
});

test("reports missing USD/CNY and missing NAV-date coverage after bounded retries", async (t) => {
  for (const payload of [
    ratesResponse({ data: { currency: "EUR/CNY" } }),
    ratesResponse({ records: [{ date: "2026-10-16", values: ["6.7220"] }] }),
  ]) {
    const fetchMock = t.mock.method(globalThis, "fetch", async () => Response.json(payload));
    await assert.rejects(fetchUsdCnyContext("2026-10-15", "2026-10-16"), /unavailable after 2 attempts/);
    assert.equal(fetchMock.mock.callCount(), 2);
    fetchMock.mock.restore();
  }
});

test("times out while reading the body as well as connecting", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (_url, { signal }) => {
    calls += 1;
    return {
      ok: true,
      json: () => new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
      }),
    };
  });
  const result = fetchUsdCnyContext("2026-10-15", "2026-10-16");
  const rejection = assert.rejects(result, /unavailable after 2 attempts: request timed out after 4000ms/);
  await setImmediate();
  t.mock.timers.tick(4000);
  await setImmediate();
  t.mock.timers.tick(4000);
  await rejection;
  assert.equal(calls, 2);
});
