import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { INDEXES, PERIOD_LABELS } from "../config.js";

const { chromium } = createRequire(import.meta.url)("playwright");
const baseUrl = process.env.INDEX_CARDS_TEST_URL || "http://127.0.0.1:8787";
const outputDir = new URL("../.wrangler/index-cards/", import.meta.url);
await mkdir(outputDir, { recursive: true });
const latest = Date.UTC(2026, 10, 3, 20, 55);
const patterns = [[100, 101, 99, 102], [100, 99, 98, 97], [100, 100, 100], [100], [100, 100.5, 101]];
function quoteFixture(source, period, legacy) {
  return { ok: true, source, period, asOfMs: latest,
    items: INDEXES.filter((item) => !item.dataSources || item.dataSources.includes(source)).map((item, i) => {
      const close = period === "MAX" ? 24920.12 : 102;
      const base = period === "MAX" ? 20 : 100;
      return { ...item, latestT: item.symbol === "MSCIUSA50" ? latest + 6 * 3600000 : latest,
        timeValidationT: item.symbol === "NDXTMC" ? latest - 6 * 3600000 : latest,
        lastClose: close, cardBaseClose: base, cardChg: close - base, cardChgPct: (close / base - 1) * 100,
        line: [100, 102, 99, close].map((value, n) => ({ t: latest - (3 - n) * 60000, close: value, pct: (value / base - 1) * 100 })),
        ...(!legacy ? { sparkline: patterns[i], sparklineChange: patterns[i].at(-1) - 100 } : {}),
      };
    }),
  };
}
const stock = { symbol: "AAPL", nameCN: "苹果", lastClose: 102, baseClose: 100, change: 2, changePct: 2,
  latestT: latest, sparkline: patterns[0] };
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
});

try {
  for (const viewport of [
    { width: 320, height: 740 }, { width: 390, height: 844 }, { width: 740, height: 320 },
    { width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 1440, height: 900 },
  ]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const errors = [];
    let legacy = false;
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/*", (route) => new URL(route.request().url()).origin === new URL(baseUrl).origin ? route.continue() : route.abort());
    await page.route("**/api/**", (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/api/quote") return route.fulfill({ json: quoteFixture(url.searchParams.get("source"), url.searchParams.get("p"), legacy) });
      if (url.pathname === "/api/star-tech") return route.fulfill({ json: { ok: true, asOfMs: latest, items: [{ ...stock, period: url.searchParams.get("p") }] } });
      return route.fulfill({ json: { ok: true, items: [] } });
    });
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.locator("#idxCards .indexHeatMeta").first().waitFor();
    let indexStyle;
    for (const source of ["yahoo", "google"]) {
      if (source === "google") {
        await page.locator('[data-index-source="google"]').click();
        await page.locator("#globalRefreshBtn").click();
      }
      for (const period of ["1D", "1M", "MAX"]) {
        await page.locator(`#seg [data-p="${period}"]`).click();
        await page.waitForFunction((label) => document.querySelector("#idxCurrentPeriod").textContent.endsWith(label), PERIOD_LABELS[period]);
        const expected = quoteFixture(source, period, false).items;
        assert.equal(await page.locator("#idxCards .sectorHeatTile").count(), expected.length);
        for (const item of expected) {
          const card = page.locator(`#idxCards .sectorHeatTile[data-symbol="${item.symbol}"]`);
          assert.equal(await card.locator(".sectorHeatLatest").count(), 0, "timestamp must not remain in a separate footer");
          assert.equal(await card.locator(".indexHeatMeta strong").textContent(), "+" + item.cardChg.toFixed(2));
          assert.equal(await card.locator(".sectorHeatSparkline").count(), item.sparkline.length > 1 ? 1 : 0);
          assert.equal(await card.locator(".indexHeatMeta .cardTimeAnomaly").count(), item.symbol === "NDXTMC" ? 1 : 0);
          const layout = await card.evaluate((el) => {
            const bounds = el.getBoundingClientRect();
            const change = el.querySelector(".indexHeatMeta strong").getBoundingClientRect();
            const time = el.querySelector(".indexHeatMeta .sectorHeatExtraLatest").getBoundingClientRect();
            const summary = el.querySelector(".indexHeatSummary").getBoundingClientRect();
            const percent = el.querySelector(".sectorHeatPct");
            const range = document.createRange();
            range.selectNodeContents(percent);
            return { left: bounds.left, right: bounds.right, change: change.toJSON(), time: time.toJSON(),
              summaryRight: summary.right, percentRight: range.getBoundingClientRect().right,
              timeFits: el.querySelector(".sectorHeatExtraLatest").scrollWidth <= el.querySelector(".sectorHeatExtraLatest").clientWidth + 1 };
          });
          assert.ok(Math.abs((layout.change.top + layout.change.bottom) / 2 - (layout.time.top + layout.time.bottom) / 2) < 4, "change and timestamp are not on the same line");
          assert.ok(layout.change.right + 4 <= layout.time.left, "change overlaps timestamp");
          assert.ok(layout.time.right <= layout.right && layout.change.left >= layout.left);
          assert.ok(layout.timeFits, "complete timestamp is clipped");
          assert.ok(layout.percentRight <= layout.summaryRight + 1, "long percentage overlaps the sparkline");
        }
        const wave = page.locator('#idxCards [data-symbol="SP500-45"] .sectorHeatSparkline');
        const shape = await wave.locator("polyline").getAttribute("points");
        assert.equal(shape, "2.00,27.00 40.67,15.00 79.33,39.00 118.00,3.00", "sparkline must keep its intraday shape across selected periods");
        indexStyle = await wave.locator("polyline").evaluate((el) => ({ stroke: getComputedStyle(el).stroke, width: getComputedStyle(el).strokeWidth }));
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        if (period === "1D") await page.locator("#idxCards .sectorHeatTile").first().screenshot({ animations: "disabled", path: fileURLToPath(new URL(`${viewport.width}-${source}-day-card.png`, outputDir)) });
      }
      await page.screenshot({ animations: "disabled", path: fileURLToPath(new URL(`${viewport.width}-${source}.png`, outputDir)) });
    }
    await page.locator('#pageSeg [data-page="stars"]').click();
    await page.locator('#starTechPanel [data-star-p="1D"]').click();
    await page.locator("#starTechPanel .sectorHeatTile").waitFor();
    assert.equal(await page.locator("#starTechPanel .sectorHeatSparkline").count(), 0, "watchlist 1D behavior changed");
    await page.locator('#starTechPanel [data-star-p="1M"]').click();
    await page.locator("#starTechPanel .sectorHeatSparkline polyline").waitFor();
    const stockStyle = await page.locator("#starTechPanel .sectorHeatSparkline polyline").evaluate((el) => ({ stroke: getComputedStyle(el).stroke, width: getComputedStyle(el).strokeWidth }));
    assert.deepEqual(stockStyle, indexStyle, "index sparkline must reuse the watchlist appearance");
    legacy = true;
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator("#idxCards .indexHeatMeta").first().waitFor();
    assert.equal(await page.locator("#idxCards .sectorHeatSparkline").count(), 5, "legacy daily payload should reuse its existing daily line");
    assert.deepEqual(errors, []);
    console.log(`PASS ${viewport.width}: both sources, intraday shape, date/change alignment, time validation, long percentages, watchlist isolation`);
    await context.close();
  }
} finally {
  await browser.close();
}
