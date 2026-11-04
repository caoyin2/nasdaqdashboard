import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const { chromium } = createRequire(import.meta.url)("playwright");
const baseUrl = process.env.NAV_TEST_URL || "http://127.0.0.1:8787";
const outputDir = new URL("../.wrangler/navigation-ui/", import.meta.url);
await mkdir(outputDir, { recursive: true });
const pages = ["overview", "fundPremiums", "stars", "weights", "sectors"];
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
});

try {
  for (const viewport of [
    { width: 320, height: 740 }, { width: 360, height: 800 }, { width: 390, height: 844 },
    { width: 430, height: 932 }, { width: 680, height: 900 }, { width: 740, height: 320 },
    { width: 768, height: 1024 }, { width: 980, height: 800 },
    { width: 1024, height: 768 }, { width: 1440, height: 900 },
  ]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/*", (route) => new URL(route.request().url()).origin === new URL(baseUrl).origin
      ? route.continue() : route.abort());
    await page.route("**/api/**", (route) => route.fulfill({ json: { ok: true, items: [] } }));
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    assert.equal(await page.locator('#pageSeg [data-page="stars"]').textContent(), "自选股列表");
    const layout = await page.locator("#pageSeg").evaluate((nav) => {
      const bounds = nav.getBoundingClientRect();
      const buttons = [...nav.querySelectorAll("button")].map((button) => {
        const rect = button.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(button);
        return { code: button.dataset.page, rect: rect.toJSON(),
          textFits: [...range.getClientRects()].every((text) => text.left >= rect.left && text.right <= rect.right && text.top >= rect.top && text.bottom <= rect.bottom) };
      });
      return { bounds: bounds.toJSON(), buttons, scrollWidth: nav.scrollWidth, clientWidth: nav.clientWidth,
        overflow: getComputedStyle(nav).overflowX, scrollLeft: nav.scrollLeft };
    });
    assert.deepEqual(layout.buttons.map((button) => button.code), pages);
    if (viewport.width <= 980) {
      assert.equal(layout.overflow, "auto", "mobile navigation must keep the original sliding strip");
      if (viewport.width <= 430) assert.ok(layout.scrollWidth > layout.clientWidth, "phone navigation must remain horizontally scrollable");
    } else {
      assert.ok(layout.scrollWidth <= layout.clientWidth + 1);
    }
    assert.equal(layout.scrollLeft, 0);
    for (const button of layout.buttons) {
      if (viewport.width > 980) assert.ok(button.rect.left >= layout.bounds.left && button.rect.right <= layout.bounds.right);
      assert.ok(button.rect.top >= layout.bounds.top && button.rect.bottom <= layout.bounds.bottom);
      assert.ok(Math.abs(button.rect.top - layout.buttons[0].rect.top) < 1, "navigation must stay on one row");
      assert.ok(button.textFits, `${button.code} label clipped`);
    }
    for (let i = 0; i < layout.buttons.length; i++) {
      for (let j = i + 1; j < layout.buttons.length; j++) {
        const a = layout.buttons[i].rect;
        const b = layout.buttons[j].rect;
        assert.ok(Math.min(a.right, b.right) <= Math.max(a.left, b.left) || Math.min(a.bottom, b.bottom) <= Math.max(a.top, b.top), "feature buttons overlap");
      }
    }
    for (const code of pages) {
      await page.locator(`#pageSeg [data-page="${code}"]`).click();
      assert.equal(await page.locator("#pages > .page-active").getAttribute("data-page"), code);
      assert.equal(await page.locator('#pageSeg [aria-current="page"]').count(), 1);
      assert.equal(await page.locator('#pageSeg [aria-current="page"]').getAttribute("data-page"), code);
    }
    await page.locator('#pageSeg [data-page="stars"]').click();
    assert.equal(await page.locator("#periodCN").textContent(), "面板：自选股列表");
    assert.equal(await page.locator("#starTechPanel .starPanelTitle strong").textContent(), "自选股列表");
    await page.locator("[data-star-manage-open]").click();
    await page.locator(".starManageModal").waitFor();
    assert.equal(await page.locator(".starManageTitle strong").textContent(), "管理自选股列表");
    await page.locator('[data-star-manage-close="button"]').click();
    assert.ok(!(await page.locator("body").textContent()).includes("明星科技"), "old watchlist name remains visible");
    await page.locator('#pageSeg [data-page="overview"]').focus();
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement.dataset.page), "fundPremiums");
    await page.keyboard.press("Enter");
    assert.equal(await page.locator("#pages > .page-active").getAttribute("data-page"), "fundPremiums");
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ animations: "disabled", path: fileURLToPath(new URL(`${viewport.width}.png`, outputDir)) });
    assert.deepEqual(errors, []);
    console.log(`PASS ${viewport.width}: original sliding navigation, page/keyboard selection, watchlist labels, no clipping`);
    await context.close();
  }
} finally {
  await browser.close();
}
