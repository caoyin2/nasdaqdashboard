import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const { chromium } = createRequire(import.meta.url)("playwright");
const baseUrl = process.env.WEIGHTS_TEST_URL || "http://127.0.0.1:8787";
const outputDir = new URL("../.wrangler/three-index-weights/", import.meta.url);
await mkdir(outputDir, { recursive: true });
const codes = ["NDXTMC", "SP500-45", "NDX"];
const holdings = [
  { symbol: "NVDA", nameEn: "NVIDIA", weights: [20, 19, 18] },
  { symbol: "AAPL", nameEn: "Apple", weights: [9, 12, 8] },
  { symbol: "MSFT", nameEn: "Microsoft", weights: [8, 7, 13] },
  { symbol: "AVGO", nameEn: "Broadcom", weights: [5, 5, 3] },
  { symbol: "LONG", nameEn: "A Very Long Technology Company Name With ALongUnbrokenShareClassSuffix", weights: [2, 2, 2] },
  { symbol: "SMALL", nameEn: "Small holding", weights: [0.01, 0.02, 0.03] },
  { symbol: "ZERO", nameEn: "Zero holding", weights: [0, 0, 0] },
];
const indexes = codes.map((indexCode, i) => ({
  ok: true, indexCode, title: indexCode, basketDate: "20261029",
  items: holdings.map((item) => ({ symbol: item.symbol, nameEn: item.nameEn, weightPct: item.weights[i] }))
    .sort((a, b) => b.weightPct - a.weightPct),
}));
const common = {
  ok: true, indexCodes: codes, indexes, itemCount: holdings.length,
  items: holdings.map((item) => ({
    symbol: item.symbol, nameEn: item.nameEn,
    weights: Object.fromEntries(codes.map((code, i) => [code, item.weights[i]])),
    totalWeightPct: item.weights.reduce((sum, weight) => sum + weight, 0),
  })).sort((a, b) => b.totalWeightPct - a.totalWeightPct),
};
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
    const requests = [];
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/*", (route) => new URL(route.request().url()).origin === new URL(baseUrl).origin
      ? route.continue() : route.abort());
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
        async writeText(text) { window.exportedWeights = text; },
      } });
      localStorage.setItem("nasdaqDashboard.indexWeights.weights-ui-10.COMMON", JSON.stringify({
        schema: 1, savedAt: Date.now(), expiresAt: Date.now() + 86400000,
        payload: { ok: true, indexCodes: ["NDXTMC", "SP500-45", "NDX", "SP500"], itemCount: 1,
          items: [{ symbol: "OLD_FOUR_INDEX_RESULT", weights: { SP500: 20 } }] },
      }));
    });
    await page.route("**/api/**", async (route) => {
      const url = new URL(route.request().url());
      requests.push(url);
      if (url.pathname === "/api/index-weights-common") return route.fulfill({ json: common });
      if (url.pathname === "/api/index-weights") {
        const code = url.searchParams.get("index");
        assert.ok(codes.includes(code), `Removed weight request: ${code}`);
        return route.fulfill({ json: indexes.find((index) => index.indexCode === code) });
      }
      return route.fulfill({ json: { ok: true, items: [] } });
    });
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.locator('#pageSeg [data-page="weights"]').click();
    await page.locator(".commonWeightRow").first().waitFor();
    assert.deepEqual(await page.locator("[data-weight-index]").evaluateAll((els) => els.map((el) => el.dataset.weightIndex)), ["COMMON", ...codes]);
    assert.equal(await page.locator(".commonWeightCell").count(), holdings.length * 3);
    async function assertCommonHighlight() {
      const backgrounds = await page.locator(".weightsPanel, .commonWeightRow").evaluateAll((els) =>
        els.map((el) => getComputedStyle(el).backgroundImage));
      assert.ok(backgrounds.every((background) => {
        const rgb = background.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        return background.includes("linear-gradient") && rgb && Number(rgb[3]) > Number(rgb[1]);
      }), "blue technology styling must be preserved");
      assert.deepEqual(await page.locator(".commonWeightRow").evaluateAll((els) => els.map((el) => el.dataset.symbol)), common.items.map((item) => item.symbol));
      for (const item of holdings) {
        const row = page.locator(`.commonWeightRow[data-symbol="${item.symbol}"]`);
        const highest = Math.max(...item.weights);
        const winners = codes.filter((_, i) => highest > 0 && Math.abs(item.weights[i] - highest) < 1e-9);
        assert.deepEqual(await row.locator(".isMaxWeight").evaluateAll((els) => els.map((el) => el.dataset.index)), winners,
          `${viewport.width}: wrong maximum index for ${item.symbol}`);
        for (const [i, code] of codes.entries()) {
          const cell = row.locator(`.commonWeightCell[data-index="${code}"]`);
          assert.equal(await cell.locator("strong").textContent(), item.weights[i].toFixed(2) + "%");
          const style = await cell.evaluate((el) => ({
            text: getComputedStyle(el.querySelector("strong")).color,
            bar: getComputedStyle(el.querySelector("i")).backgroundColor,
            label: el.querySelector("strong").getAttribute("aria-label"),
          }));
          if (winners.includes(code)) {
            assert.equal(style.text, "rgb(255, 113, 136)");
            assert.equal(style.bar, "rgb(255, 93, 117)");
            assert.ok(style.label.includes("最高权重"));
          } else {
            assert.notEqual(style.text, "rgb(255, 113, 136)");
            assert.notEqual(style.bar, "rgb(255, 93, 117)");
          }
        }
      }
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "horizontal page overflow");
      const clipped = await page.locator(".commonWeightCell > span, .commonWeightCell > strong").evaluateAll((els) =>
        els.filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => el.textContent));
      assert.deepEqual(clipped, [], "weight labels clipped");
      if (viewport.width <= 980) {
        const positions = await page.locator(".commonWeightRow").first().locator(".commonWeightCell").evaluateAll((els) =>
          els.map((el) => el.getBoundingClientRect().top));
        assert.ok(Math.max(...positions) - Math.min(...positions) < 1, "mobile weights must remain side by side");
      }
    }
    await assertCommonHighlight();
    assert.ok(!(await page.locator("#indexWeightsPanel").textContent()).includes("OLD_FOUR_INDEX_RESULT"));
    assert.equal(requests.filter((url) => url.pathname === "/api/index-weights-common").length, 1);
    assert.equal(requests.find((url) => url.pathname === "/api/index-weights-common").searchParams.get("v"), "weights-ui-11");
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ animations: "disabled", path: fileURLToPath(new URL(`${viewport.width}.png`, outputDir)) });
    await page.locator("[data-weight-export-all]").click();
    await page.waitForFunction(() => !!window.exportedWeights);
    const exported = await page.evaluate(() => window.exportedWeights);
    assert.equal(exported.match(/^## /gm).length, 3);
    for (const code of codes) assert.ok(exported.includes(`（${code}）`));
    assert.ok(!exported.includes("（SP500）"));
    for (const code of codes) {
      await page.locator(`[data-weight-index="${code}"]`).click();
      await page.locator(".weightCard").first().waitFor();
      assert.equal(await page.locator(".weightCard").count(), holdings.length);
      assert.equal(await page.locator(".isMaxWeight").count(), 0, "common maxima leaked into individual index cards");
      const expectedItems = indexes.find((index) => index.indexCode === code).items;
      assert.deepEqual(await page.locator(".weightCard").evaluateAll((els) => els.map((el) => el.dataset.symbol)), expectedItems.map((item) => item.symbol));
      assert.deepEqual(await page.locator(".weightValue strong").allTextContents(), expectedItems.map((item) => item.weightPct.toFixed(2) + "%"));
      assert.equal(await page.locator(".weightBarFill").count(), holdings.length);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page.screenshot({ animations: "disabled", path: fileURLToPath(new URL(`${viewport.width}-${code}.png`, outputDir)) });
    }
    await page.locator('[data-weight-index="COMMON"]').click();
    await page.locator(".commonWeightRow").first().waitFor();
    await assertCommonHighlight();
    const beforeRefresh = requests.length;
    await page.locator("#globalRefreshBtn").click();
    assert.equal(requests.length, beforeRefresh, "top refresh must not fetch weight data");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator('#pageSeg [data-page="weights"]').click();
    await page.locator(".commonWeightRow").first().waitFor();
    await assertCommonHighlight();
    assert.equal(requests.filter((url) => url.pathname === "/api/index-weights-common").length, 1, "24-hour cache was not reused");
    assert.equal(requests.filter((url) => url.pathname === "/api/index-weights").length, 0, "individual weights were not hydrated from cache");
    assert.deepEqual(errors, []);
    console.log(`PASS ${viewport.width}: per-stock maxima, ties, zero/small weights, three-column comparison, individual panels, export, 24-hour cache`);
    await context.close();
  }
} finally {
  await browser.close();
}
