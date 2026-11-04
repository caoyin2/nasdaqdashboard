import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { SP500_SECTOR_ETFS } from "../config.js";

const { chromium } = createRequire(import.meta.url)("playwright");
const baseUrl = process.env.SECTOR_CARDS_TEST_URL || "http://127.0.0.1:8787";
const outputDir = new URL("../.wrangler/sector-cards/", import.meta.url);
await mkdir(outputDir, { recursive: true });
const latest = Date.UTC(2026, 10, 3, 20, 55);
const icon = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path fill="#fff" d="M4 4h24v24H4z"/></svg>');
function fixture(period) {
  return { ok: true, period, asOfMs: latest, items: SP500_SECTOR_ETFS.map((item, i) => ({
    ...item, icon, period, baseLabel: period === "1D" ? "昨收" : "起点",
    lastClose: 102 + i, baseClose: 100, change: 2 + i, changePct: 2 + i,
    latestT: i === 1 ? latest - 6 * 3600000 : latest, sparkline: [100, 99, 101, 102],
  })) };
}
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
});

try {
  for (const viewport of [
    { width: 320, height: 740 }, { width: 390, height: 844 }, { width: 740, height: 320 },
    { width: 768, height: 1024 }, { width: 980, height: 800 },
    { width: 1024, height: 768 }, { width: 1440, height: 900 },
  ]) {
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/*", (route) => new URL(route.request().url()).origin === new URL(baseUrl).origin ? route.continue() : route.abort());
    await page.route("**/api/**", (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/api/sp500-sectors") return route.fulfill({ json: fixture(url.searchParams.get("p")) });
      if (url.pathname === "/api/star-tech") return route.fulfill({ json: fixture(url.searchParams.get("p")) });
      return route.fulfill({ json: { ok: true, items: [] } });
    });
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.locator('#pageSeg [data-page="sectors"]').click();
    await page.locator("#sp500SectorPanel .sectorHeatDaily").first().waitFor();
    assert.equal(await page.locator("#sp500SectorPanel .sectorHeatDaily").count(), 11);
    assert.equal(await page.locator("#sp500SectorPanel .sectorHeatLatest, #sp500SectorPanel .sectorHeatSparkline").count(), 0);
    for (const item of fixture("1D").items) {
      const card = page.locator(`#sp500SectorPanel [data-symbol="${item.symbol}"]`);
      assert.equal(await card.locator(".sectorHeatDailyMain strong").textContent(), "+" + item.change.toFixed(2));
      assert.equal(await card.locator(".sectorHeatDailyMeta .cardTimeAnomaly").count(), item.symbol === "XLY" ? 1 : 0);
      assert.equal(await card.locator(".starIcon").getAttribute("src"), icon);
      const layout = await card.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        const base = el.querySelector(".sectorHeatDailyMeta > span:first-child").getBoundingClientRect();
        const time = el.querySelector(".sectorHeatMetaLatest").getBoundingClientRect();
        const percent = el.querySelector(".sectorHeatPct").getBoundingClientRect();
        const change = el.querySelector(".sectorHeatDailyMain strong").getBoundingClientRect();
        const textsFit = [...el.querySelectorAll(".sectorHeatDailyMeta span, .sectorHeatDailyMain > *")].every((node) => {
          const bounds = node.getBoundingClientRect();
          const range = document.createRange();
          range.selectNodeContents(node);
          const text = range.getBoundingClientRect();
          return text.left >= rect.left && text.right <= rect.right && text.width <= bounds.width + 1;
        });
        return { rect: rect.toJSON(), base: base.toJSON(), time: time.toJSON(), percent: percent.toJSON(), change: change.toJSON(), rows: el.children.length, textsFit };
      });
      assert.equal(layout.rows, 3, "daily sector card must not keep a separate timestamp row");
      assert.ok(Math.abs(layout.base.bottom - layout.time.bottom) < 5, "base price and latest timestamp must share a row");
      assert.ok(layout.base.right + 4 <= layout.time.left, "base price overlaps timestamp");
      assert.ok(layout.percent.right + 4 <= layout.change.left, "percentage overlaps change");
      assert.ok(layout.textsFit, "daily card text is clipped");
      assert.ok(layout.rect.height < 190, "daily card did not become compact");
    }
    await page.evaluate(() => document.querySelector("#sp500SectorPanel").scrollIntoView());
    await page.screenshot({ animations: "disabled", path: fileURLToPath(new URL(`${viewport.width}-daily.png`, outputDir)) });
    await page.locator('#sectorPeriodSeg [data-sector-p="1M"]').click();
    await page.locator("#sp500SectorPanel .sectorHeatSparkline").first().waitFor();
    assert.equal(await page.locator("#sp500SectorPanel .sectorHeatDaily").count(), 0, "other periods must keep their existing layout");
    assert.equal(await page.locator("#sp500SectorPanel .sectorHeatSparkline").count(), 11);
    assert.equal(await page.locator("#sp500SectorPanel .sectorHeatMetaLatest").count(), 11);
    await page.locator('#sectorPeriodSeg [data-sector-p="1D"]').click();
    await page.locator("#sp500SectorPanel .sectorHeatDaily").first().waitFor();
    await page.locator('#pageSeg [data-page="stars"]').click();
    await page.locator("#starTechPanel .sectorHeatTile").first().waitFor();
    assert.equal(await page.locator("#starTechPanel .sectorHeatDaily").count(), 0, "shared card renderer changed the watchlist");
    assert.equal(await page.locator("#starTechPanel .sectorHeatLatest").count(), 11);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.deepEqual(errors, []);
    console.log(`PASS ${viewport.width}: compact 1D sector cards, inline timestamps, anomalies/icons preserved, other periods/watchlist unchanged`);
    await context.close();
  }
} finally {
  await browser.close();
}
