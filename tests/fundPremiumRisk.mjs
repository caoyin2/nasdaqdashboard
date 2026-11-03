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
  { code: "161128", nameCN: "标普信息科技LOF", premiumPct: 30, premiumReferenceNav: 9, lofPremium: { estimatedNav: 2.123456789 } },
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
const missingQuoteWarnings = [
  { code: "159632", message: "Calculation unavailable" },
  { code: "159870", message: "Quote unavailable" },
  { code: "159870", message: "Duplicate warning" },
];
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
    let warnings = missingQuoteWarnings;
    let quoteFails = false;
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/*", (route) => new URL(route.request().url()).origin === new URL(baseUrl).origin
      ? route.continue() : route.abort());
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      requests.push(path);
      if (path !== "/api/fund-premiums") return route.fulfill({ json: { ok: true, items: [] } });
      if (quoteFails) return route.fulfill({ status: 502, json: { ok: false, error: "Quote unavailable" } });
      return route.fulfill({ json: {
        ok: true, asOfMs: Date.UTC(2026, 9, 29, 7), tradeDate: "2026-10-29", warnings,
        items: premiums.map((item) => ({
          ...item, symbol: item.symbol || (/^5/.test(item.code) ? "sh" : "sz") + item.code,
          lastClose: 2.345, baseClose: 2.3, change: 0.045, changePct: 1.96, tradeDate: "2026-10-29",
        })),
      } });
    });
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.locator('#pageSeg [data-page="fundPremiums"]').click();
    await page.locator(".fundPremiumTile").first().waitFor();
    const lofNav = page.locator('.fundPremiumTile[data-symbol="sz161128"] .fundPremiumNav strong');
    async function assertSummary({ total, risk, unavailable = 0 }) {
      const meter = page.locator('.fundPremiumRiskTrack[role="meter"]');
      assert.equal(await meter.count(), 1);
      assert.equal(await meter.getAttribute("aria-valuenow"), String(risk));
      assert.equal(await meter.getAttribute("aria-valuemax"), String(total));
      assert.equal(await page.locator(".fundPremiumRiskStats b").textContent(), (risk / total * 100).toFixed(1) + "%");
      assert.equal(await page.locator(".fundPremiumRiskCount").textContent(), `${risk}/${total}只`);
      assert.equal(await page.locator(".fundPremiumRiskHeader > strong").textContent(), "下一交易日停牌预警");
      assert.equal(await page.locator(".fundPremiumRiskLegendOther strong").textContent(), `${total - risk - unavailable}只`);
      assert.equal(await page.locator(".fundPremiumRiskLegendUnavailable").count(), unavailable ? 1 : 0);
      if (unavailable) assert.equal(await page.locator(".fundPremiumRiskLegendUnavailable strong").textContent(), `${unavailable}只`);
      const shares = await meter.evaluate((el) => [...el.children].map((child) => parseFloat(child.style.width)));
      assert.ok(Math.abs(shares.reduce((sum, share) => sum + share, 0) - 100) < 0.001);
      assert.ok(Math.abs(shares[0] - risk / total * 100) < 0.001);
      assert.ok(Math.abs(shares[2] - unavailable / total * 100) < 0.001);
      const geometry = await page.locator(".fundPremiumRiskSummary").evaluate((summary) => {
        const track = summary.querySelector(".fundPremiumRiskTrack").getBoundingClientRect();
        const fill = summary.querySelector(".fundPremiumRiskFill").getBoundingClientRect();
        const slash = summary.querySelector(".fundPremiumRiskSlash").getBoundingClientRect();
        const numerator = summary.querySelector(".fundPremiumRiskNumerator").getBoundingClientRect();
        const denominator = summary.querySelector(".fundPremiumRiskDenominator").getBoundingClientRect();
        const bounds = summary.getBoundingClientRect();
        return { boundary: track.left + fill.width, slashCenter: slash.left + slash.width / 2,
          labelBottom: Math.max(numerator.bottom, slash.bottom, denominator.bottom), trackTop: track.top,
          labelLeft: numerator.left, labelRight: denominator.right, left: bounds.left, right: bounds.right };
      });
      assert.ok(Math.abs(geometry.boundary - geometry.slashCenter) < 0.75, `slash does not align with the color boundary: ${JSON.stringify(geometry)}`);
      assert.equal(await page.locator(".fundPremiumRiskArrow").count(), 0, "removed risk arrow must not return");
      assert.ok(geometry.labelBottom <= geometry.trackTop, "numbers overlap the track");
      assert.ok(geometry.labelLeft >= geometry.left && geometry.labelRight <= geometry.right, "counts overflow at the scale endpoints");
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "horizontal page overflow");
    }
    async function refreshFunds() {
      await page.locator("#globalRefreshBtn").click();
      await page.locator("#globalRefreshBtn:not([disabled])").waitFor();
    }
    await assertSummary({ total: 19, risk: expectedRisk, unavailable: 5 });
    assert.equal(await lofNav.textContent(), "2.123457", "NAV must use the computed value, not Tencent's reference NAV");
    assert.equal(await page.locator(".fundPremiumNav").count(), 1, "ETF must not acquire a LOF NAV row");
    assert.equal(await page.locator(".hasHaltRisk").count(), expectedRisk);
    assert.deepEqual(await page.locator(".fundPremiumHaltRisk strong").allTextContents(),
      Array(expectedRisk).fill("下一交易日停牌预警！"));
    assert.deepEqual(await page.locator(".fundPremiumHaltRisk").allTextContents(),
      Array(expectedRisk).fill("下一交易日停牌预警！"));
    assert.equal(await page.locator(".fundPremiumRiskBanner").count(), 0);
    assert.equal(await page.locator(".fundPremiumRiskIcon").count(), 0);
    for (const item of cases) {
      const symbol = item.symbol || (/^5/.test(item.code) ? "sh" : "sz") + item.code;
      assert.equal(await page.locator(`.fundPremiumTile[data-symbol="${symbol}"] .fundPremiumHaltRisk`).count(), item.risk ? 1 : 0,
        `${viewport.width}: wrong risk result for ${symbol}`);
    }
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "horizontal page overflow");
    const clipped = await page.locator(".fundPremiumHaltRisk").evaluateAll((elements) => elements.some((el) => el.scrollWidth > el.clientWidth + 1));
    assert.equal(clipped, false, "risk text clipped");
    await page.screenshot({ animations: "disabled", path: fileURLToPath(new URL(`${viewport.width}.png`, outputDir)) });
    await page.locator('.fundPremiumTile[data-symbol="sz161128"]').screenshot({ animations: "disabled", path: fileURLToPath(new URL(`lof-${viewport.width}.png`, outputDir)) });

    // Manual refresh clears the cache; a failed request must not invent warnings.
    quoteFails = true;
    await refreshFunds();
    await page.waitForFunction(() => document.querySelector(".fundPremiumPanel .starPanelMetaText.err")?.textContent.includes("502"));
    assert.equal(await page.locator(".hasHaltRisk").count(), 0);
    assert.equal(await page.locator(".fundPremiumRiskBanner").count(), 0);
    assert.equal(await page.locator(".fundPremiumRiskSummary").count(), 0, "request failure must not imply zero risk");
    assert.equal(await lofNav.count(), 0, "failed refresh must not show stale NAV");
    quoteFails = false;
    premiums = cases.map((item) => ({
      ...item, premiumPct: /^16|^50/.test(item.code || "") ? 40 : 9.99,
      ...(item.code === "161128" ? { lofPremium: { estimatedNav: 3.456789123 } } : {}),
    }));
    const requestStart = requests.length;
    await refreshFunds();
    await page.waitForFunction((count) => document.querySelectorAll(".fundPremiumTile").length === count, cases.length);
    assert.equal(await page.locator(".hasHaltRisk").count(), 0, "warning did not clear after premium fell");
    assert.equal(await page.locator(".fundPremiumTile").count(), cases.length, "normal fund cards disappeared");
    assert.deepEqual(requests.slice(requestStart), ["/api/fund-premiums"], "refresh requested another panel");
    await assertSummary({ total: 19, risk: 0, unavailable: 2 });
    assert.equal(await lofNav.textContent(), "3.456789", "NAV did not update on refresh");

    warnings = [];
    premiums = cases.map((item) => item.code === "161128"
      ? { ...item, lofPremiumError: "Index unavailable", premiumPct: null }
      : item);
    await refreshFunds();
    assert.equal(await lofNav.textContent(), "--", "failed LOF valuation must hide the previous computed value");
    assert.equal(await page.locator(".fundPremiumTile").count(), cases.length);
    await assertSummary({ total: 18, risk: expectedRisk, unavailable: 5 });

    premiums = [{ ...cases[7], lofPremium: { estimatedNav: null } }];
    await refreshFunds();
    assert.equal(await lofNav.textContent(), "--", "missing NAV must not become zero or use an uncorrected reference NAV");
    await assertSummary({ total: 1, risk: 0 });

    premiums = [cases[0]];
    await refreshFunds();
    await assertSummary({ total: 1, risk: 1 });
    for (const risk of [1, 19]) {
      premiums = Array.from({ length: 20 }, (_, i) => ({ code: "159" + String(i).padStart(3, "0"), nameCN: "测试ETF", premiumPct: i < risk ? 12 : 5 }));
      await refreshFunds();
      await assertSummary({ total: 20, risk });
      await page.setViewportSize({ width: viewport.width + 17, height: viewport.height });
      await assertSummary({ total: 20, risk });
      await page.setViewportSize(viewport);
    }
    premiums = [cases[6]];
    await refreshFunds();
    await assertSummary({ total: 1, risk: 0, unavailable: 1 });
    premiums = [];
    warnings = [{ code: "159870", message: "Quote unavailable" }];
    await refreshFunds();
    await assertSummary({ total: 1, risk: 0, unavailable: 1 });
    warnings = [];
    await refreshFunds();
    assert.equal(await page.locator(".fundPremiumRiskSummary").count(), 0, "empty list must not produce NaN percentages");
    assert.deepEqual(errors, []);
    console.log(`PASS ${viewport.width}x${viewport.height}: classification, risk ratios, missing quotes, NAV, refresh, empty/full/unknown, layout`);
    await context.close();
  }
} finally {
  await browser.close();
}
