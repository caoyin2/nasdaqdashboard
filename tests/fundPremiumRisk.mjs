import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const baseUrl = process.env.FUND_TEST_URL || "http://127.0.0.1:8787";
const outputDir = new URL("../.wrangler/fund-premium-risk/", import.meta.url);
await mkdir(outputDir, { recursive: true });
const cases = [
  { code: "513100", nameCN: "国泰纳指ETF", premiumPct: 10, risk: true },
  { code: "159941", nameCN: "广发纳指ETF", premiumPct: 10.01, risk: true },
  { code: "159509", nameCN: "景顺长城纳指科技", premiumPct: 12, risk: true },
  { code: "513300", nameCN: "华夏纳斯达克ETF", premiumPct: 9.99 },
  { code: "513390", nameCN: "博时纳指ETF", premiumPct: -12 },
  { code: "159660", nameCN: "汇添富纳指ETF", premiumPct: 0 },
  { code: "159501", nameCN: "嘉实纳指ETF", premiumPct: null },
  { code: "161128", nameCN: "标普信息科技LOF", premiumPct: 30 },
  { code: "501225", nameCN: "全球芯片LOF", premiumPct: 35 },
  { code: "161130", nameCN: "纳指ETF联接", premiumPct: 40 },
  { code: "513650", nameCN: "LOF exclusion takes precedence", premiumPct: 20 },
  { code: "000001", nameCN: "普通开放式基金", premiumPct: 15 },
  { code: "159632", nameCN: "行情计算失败ETF", premiumPct: 11, lofPremiumError: "Unavailable" },
  { code: "513400", nameCN: "道琼斯ETF", premiumPct: 60, risk: true },
  { symbol: "sz159577", nameCN: "美国50ETF", premiumPct: 12, risk: true },
  { code: "159513", nameCN: "无溢价数据ETF" },
  { code: "159659", nameCN: "非数值溢价ETF", premiumPct: "10" },
  { code: "513850", nameCN: "带LOF估值的基金", premiumPct: 15, lofPremium: {} },
];
const expectedRisk = cases.filter((item) => item.risk).length;
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
});

try {
  for (const viewport of [
    { width: 320, height: 740 }, { width: 390, height: 844 },
    { width: 740, height: 320 }, { width: 1440, height: 900 },
  ]) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: viewport.width <= 740 ? 2 : 1 });
    const page = await context.newPage();
    const errors = [];
    const requests = [];
    let premiums = cases;
    let quoteFails = false;
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      requests.push(path);
      if (path !== "/api/fund-premiums") return route.fulfill({ json: { ok: true, items: [] } });
      if (quoteFails) return route.fulfill({ status: 502, json: { ok: false, error: "Quote unavailable" } });
      return route.fulfill({ json: {
        ok: true, asOfMs: Date.UTC(2026, 9, 29, 7), tradeDate: "2026-10-29", warnings: [],
        items: premiums.map((item) => ({
          ...item, symbol: item.symbol || (/^5/.test(item.code) ? "sh" : "sz") + item.code,
          lastClose: 2.345, baseClose: 2.3, change: 0.045, changePct: 1.96, tradeDate: "2026-10-29",
        })),
      } });
    });
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.locator('#pageSeg [data-page="fundPremiums"]').click();
    await page.locator(".fundPremiumTile").first().waitFor();
    assert.equal(await page.locator(".hasHaltRisk").count(), expectedRisk);
    assert.deepEqual(await page.locator(".fundPremiumHaltRisk strong").allTextContents(),
      Array(expectedRisk).fill("次一交易日停牌预警！"));
    assert.deepEqual(await page.locator(".fundPremiumHaltRisk").allTextContents(),
      Array(expectedRisk).fill("次一交易日停牌预警！"));
    assert.equal(await page.locator(".fundPremiumRiskIcon").textContent(), "!");
    assert.ok((await page.locator(".fundPremiumRiskBanner").textContent()).includes(expectedRisk + "只ETF"));
    assert.ok((await page.locator(".fundPremiumRiskBanner").textContent()).includes("以基金公告为准"));
    for (const item of cases) {
      const symbol = item.symbol || (/^5/.test(item.code) ? "sh" : "sz") + item.code;
      assert.equal(await page.locator(`.fundPremiumTile[data-symbol="${symbol}"] .fundPremiumHaltRisk`).count(), item.risk ? 1 : 0,
        `${viewport.width}: wrong risk result for ${symbol}`);
    }
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "horizontal page overflow");
    const clipped = await page.locator(".fundPremiumRiskBanner, .fundPremiumHaltRisk").evaluateAll((elements) => elements.some((el) => el.scrollWidth > el.clientWidth + 1));
    assert.equal(clipped, false, "risk text clipped");
    await page.screenshot({ path: fileURLToPath(new URL(`${viewport.width}.png`, outputDir)) });

    // Manual refresh clears the cache; a failed request must not invent warnings.
    quoteFails = true;
    await page.locator("#globalRefreshBtn").click();
    await page.waitForFunction(() => document.querySelector(".fundPremiumPanel .starPanelMetaText.err")?.textContent.includes("502"));
    assert.equal(await page.locator(".hasHaltRisk").count(), 0);
    assert.equal(await page.locator(".fundPremiumRiskBanner").count(), 0);
    quoteFails = false;
    premiums = cases.map((item) => ({ ...item, premiumPct: /^16|^50/.test(item.code || "") ? 40 : 9.99 }));
    const requestStart = requests.length;
    await page.locator("#globalRefreshBtn").click();
    await page.waitForFunction((count) => document.querySelectorAll(".fundPremiumTile").length === count, cases.length);
    assert.equal(await page.locator(".hasHaltRisk").count(), 0, "warning did not clear after premium fell");
    assert.equal(await page.locator(".fundPremiumTile").count(), cases.length, "normal fund cards disappeared");
    assert.deepEqual(requests.slice(requestStart), ["/api/fund-premiums"], "refresh requested another panel");
    assert.deepEqual(errors, []);
    console.log(`PASS ${viewport.width}x${viewport.height}: 18 classification cases, refresh, LOF exclusions, layout`);
    await context.close();
  }
} finally {
  await browser.close();
}
