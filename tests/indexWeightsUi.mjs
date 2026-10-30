import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const { chromium } = createRequire(import.meta.url)("playwright");
const baseUrl = process.env.WEIGHTS_TEST_URL || "http://127.0.0.1:8787";
const outputDir = new URL("../.wrangler/three-index-weights/", import.meta.url);
await mkdir(outputDir, { recursive: true });
const codes = ["NDXTMC", "SP500-45", "NDX"];
const indexes = codes.map((indexCode, i) => ({
  ok: true, indexCode, title: indexCode, basketDate: "20261029",
  items: [{ symbol: "NVDA", nameEn: "NVIDIA", weightPct: 20 - i }, { symbol: "AAPL", nameEn: "Apple", weightPct: 10 - i }],
}));
const common = {
  ok: true, indexCodes: codes, indexes, itemCount: 2,
  items: indexes[0].items.map((item, n) => ({
    ...item, weights: Object.fromEntries(indexes.map((index) => [index.indexCode, index.items[n].weightPct])),
    totalWeightPct: indexes.reduce((sum, index) => sum + index.items[n].weightPct, 0),
  })),
};
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
});
try {
  for (const viewport of [{ width: 320, height: 740 }, { width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const requests = [];
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
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
    assert.equal(await page.locator(".commonWeightCell").count(), 6);
    assert.ok(!(await page.locator("#indexWeightsPanel").textContent()).includes("OLD_FOUR_INDEX_RESULT"));
    assert.equal(requests.filter((url) => url.pathname === "/api/index-weights-common").length, 1);
    assert.equal(requests.find((url) => url.pathname === "/api/index-weights-common").searchParams.get("v"), "weights-ui-11");
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.locator("[data-weight-export-all]").click();
    await page.waitForFunction(() => !!window.exportedWeights);
    const exported = await page.evaluate(() => window.exportedWeights);
    assert.equal(exported.match(/^## /gm).length, 3);
    for (const code of codes) assert.ok(exported.includes(`（${code}）`));
    assert.ok(!exported.includes("（SP500）"));
    for (const code of codes) {
      await page.locator(`[data-weight-index="${code}"]`).click();
      await page.locator(".weightCard").first().waitFor();
      assert.equal(await page.locator(".weightCard").count(), 2);
    }
    await page.locator('[data-weight-index="COMMON"]').click();
    await page.locator(".commonWeightRow").first().waitFor();
    await page.screenshot({ path: fileURLToPath(new URL(`${viewport.width}.png`, outputDir)) });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator('#pageSeg [data-page="weights"]').click();
    await page.locator(".commonWeightRow").first().waitFor();
    assert.equal(requests.filter((url) => url.pathname === "/api/index-weights-common").length, 1, "24-hour cache was not reused");
    assert.equal(requests.filter((url) => url.pathname === "/api/index-weights").length, 0, "individual weights were not hydrated from cache");
    assert.deepEqual(errors, []);
    console.log(`PASS ${viewport.width}: three indexes, common holdings, export, old-cache invalidation, 24-hour cache`);
    await context.close();
  }
} finally {
  await browser.close();
}
