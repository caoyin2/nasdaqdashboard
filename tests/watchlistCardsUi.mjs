import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const { chromium } = createRequire(import.meta.url)("playwright");
const baseUrl = process.env.WATCHLIST_CARDS_TEST_URL || "http://127.0.0.1:8787";
const outputDir = new URL("../.wrangler/watchlist-daily/", import.meta.url);
await mkdir(outputDir, { recursive: true });
const latest = Date.UTC(2026, 10, 3, 21);
const icon = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path fill="#fff" d="M4 4h24v24H4z"/></svg>');
const stocks = [
  { symbol: "ORCL", nameCN: "甲骨文", lastClose: 126.19, baseClose: 119.22, change: 6.97, changePct: 5.85,
    peRatioFwd: 14.78, peRatioCurrent: 19.79, marketCapCN: "3825.5亿", priceTargetValue: 235.46, priceTargetPct: 86.59 },
  { symbol: "MSFT", nameCN: "微软", lastClose: 520.99, baseClose: 507.12, change: 13.87, changePct: 2.74,
    peRatioFwd: 25.1, peRatioCurrent: 27.2, marketCapCN: "3.87万亿", priceTargetValue: 633.13, priceTargetPct: 21.52 },
  { symbol: "SNDK", nameCN: "闪迪", lastClose: 1126.52, baseClose: 1075.08, change: 51.44, changePct: 4.78,
    peRatioFwd: 4.6, peRatioCurrent: 9.06, marketCapCN: "1602.9亿", priceTargetValue: 2023.63, priceTargetPct: 79.64 },
  { symbol: "LONG", nameCN: "长数字测试", lastClose: 12345.67, baseClose: 23456.78, change: -11111.11, changePct: -47.37,
    peRatioFwdLoss: true, peRatioCurrent: 12345.67, marketCapCN: "12345.67万亿", priceTargetValue: 123456.78, priceTargetPct: -123.45 },
  { symbol: "LOSS", nameCN: "亏损与缺失指标", lastClose: 10, baseClose: 11, change: -1, changePct: -9.09,
    peRatioFwdLoss: true, peRatioCurrentLoss: true, marketCapCN: null, priceTargetValue: null, priceTargetPct: null },
  { symbol: "EMPTY", nameCN: "基本面暂未返回", lastClose: 10, baseClose: 10, change: 0, changePct: 0 },
].map((stock) => ({ ...stock, icon, latestT: stock.symbol === "ORCL" ? latest - 6 * 3600000 : latest, sparkline: [100, 102, 99, 103] }));
function fixture(period, fundamentals) {
  return { ok: true, period, asOfMs: latest, items: stocks.map((stock) => ({ ...stock, period, baseLabel: period === "1D" ? "昨收" : "起点",
    ...(!fundamentals ? { peRatioFwd: null, peRatioCurrent: null, peRatioFwdLoss: false, peRatioCurrentLoss: false,
      marketCapCN: null, priceTargetValue: null, priceTargetPct: null } : {}),
  })) };
}
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
});

try {
  for (const viewport of [
    { width: 320, height: 740 }, { width: 360, height: 800 }, { width: 390, height: 844 },
    { width: 430, height: 932 }, { width: 740, height: 320 }, { width: 768, height: 1024 },
    { width: 980, height: 800 }, { width: 1024, height: 768 }, { width: 1440, height: 900 },
  ]) {
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/*", (route) => new URL(route.request().url()).origin === new URL(baseUrl).origin ? route.continue() : route.abort());
    await page.route("**/api/**", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/api/star-tech") return route.fulfill({ json: fixture(url.searchParams.get("p"), false) });
      if (url.pathname === "/api/star-tech-forward-pe") {
        await new Promise((resolve) => setTimeout(resolve, 150));
        return route.fulfill({ json: fixture("1D", true) });
      }
      return route.fulfill({ json: { ok: true, items: [] } });
    });
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.locator('#pageSeg [data-page="stars"]').click();
    await page.locator('#starTechPanel [data-symbol="ORCL"] .sectorHeatTarget').waitFor();
    assert.equal(await page.locator("#starTechPanel .watchlistDaily").count(), stocks.length);
    assert.equal(await page.locator("#starTechPanel .sectorHeatSparkline").count(), 0);
    for (const stock of stocks.filter((item) => item.symbol !== "EMPTY")) {
      const card = page.locator(`#starTechPanel [data-symbol="${stock.symbol}"]`);
      assert.equal(await card.locator(".starIcon").getAttribute("src"), icon);
      assert.equal(await card.locator(".cardTimeAnomaly").count(), stock.symbol === "ORCL" ? 1 : 0);
      const layout = await card.evaluate((el) => {
        const stack = el.querySelector(".sectorHeatInfoStack");
        const bounds = stack.getBoundingClientRect();
        const nodes = [...stack.querySelectorAll(".sectorHeatMetaStar > span, .sectorHeatExtraStar > span, .sectorHeatMetaStar > strong")];
        const positions = nodes.map((node) => {
          const rect = node.getBoundingClientRect();
          const range = document.createRange();
          range.selectNodeContents(node);
          const textRects = [...range.getClientRects()].filter((text) => text.width > 0);
          return { className: node.className, rect: rect.toJSON(), textLeft: Math.min(...textRects.map((text) => text.left)), fits: textRects.every((text) => text.left >= rect.left - 1 && text.right <= rect.right + 1 && text.left >= bounds.left - 1 && text.right <= bounds.right + 1) };
        });
        return { positions, base: positions[0], target: positions[1], font: getComputedStyle(nodes[0]).fontSize };
      });
      assert.equal(layout.positions.length, 6, "daily metrics must contain three complete pairs");
      const rightColumnStarts = [1, 3, 5].map((index) => layout.positions[index].textLeft);
      assert.ok(Math.max(...rightColumnStarts) - Math.min(...rightColumnStarts) < 1,
        `${viewport.width} ${stock.symbol}: target, current PE and latest timestamp must start at the same column`);
      for (let row = 0; row < 3; row++) {
        const [left, right] = layout.positions.slice(row * 2, row * 2 + 2);
        assert.ok(Math.abs(left.rect.bottom - right.rect.bottom) < 5, "paired values must share a row");
        assert.ok(left.rect.right + 3 <= right.rect.left, "metric values overlap");
        assert.ok(left.fits && right.fits, `${viewport.width} ${stock.symbol} row ${row + 1}: complete metric text is clipped`);
        if (row) assert.ok(layout.positions[row * 2 - 1].rect.bottom <= left.rect.top, "metric rows overlap");
      }
      if (viewport.width > 1200) assert.equal(layout.font, "12px", "desktop metric typography changed");
    }
    await page.evaluate(() => document.querySelector("#starTechPanel").scrollIntoView());
    await page.screenshot({ animations: "disabled", path: fileURLToPath(new URL(`${viewport.width}-daily.png`, outputDir)) });
    await page.locator('#starTechPanel [data-star-p="1M"]').click();
    await page.locator("#starTechPanel .sectorHeatSparkline").first().waitFor();
    assert.equal(await page.locator("#starTechPanel .watchlistDaily").count(), 0, "non-daily layout must remain unchanged");
    const display = await page.locator("#starTechPanel .sectorHeatMetaStar").first().evaluate((el) => getComputedStyle(el).display);
    assert.equal(display, viewport.width <= 980 ? "flex" : "grid");
    await page.locator('#starTechPanel [data-star-p="1D"]').click();
    await page.locator("#starTechPanel .watchlistDaily").first().waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.deepEqual(errors, []);
    console.log(`PASS ${viewport.width}: three paired daily metric rows, targets/PE/market cap/timestamps complete, anomalies/icons and non-daily layout preserved`);
    await context.close();
  }
} finally {
  await browser.close();
}
