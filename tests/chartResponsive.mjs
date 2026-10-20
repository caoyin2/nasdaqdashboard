import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { INDEXES, INDEX_DATA_SOURCES, PERIOD_LABELS } from "../config.js";

// NODE_PATH may point at an existing Playwright installation; no production dependency is needed.
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const baseUrl = process.env.CHART_TEST_URL || "http://127.0.0.1:8787";
const outputDir = new URL("../.wrangler/chart-responsive/", import.meta.url);
await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
});
let checks = 0;

function quoteFixture(source, period) {
  const end = Date.UTC(2026, 9, 16, 20);
  const spanDays = { "1D": 0.27, "5D": 5, "1M": 30, "6M": 180, YTD: 288, "1Y": 365, "5Y": 1826, MAX: 15000 }[period];
  const times = Array.from({ length: 80 }, (_, i) => Math.round(end - spanDays * 86400000 * (79 - i) / 79));
  const items = INDEXES.filter((item) => !item.dataSources || item.dataSources.includes(source)).map((item, index) => {
    const growth = period === "MAX" ? (index + 1) * 2100 : (index + 1) * 0.7 - 1.3;
    const line = times.map((t, i) => {
      const pct = growth * i / 79 + Math.sin(i / 12) * (index + 1) / 3;
      return { t, pct, close: 100 * (1 + pct / 100) };
    });
    return { ...item, latestT: end, timeValidationT: end, lastClose: line.at(-1).close, cardBaseClose: 100,
      cardChg: line.at(-1).close - 100, cardChgPct: line.at(-1).pct, line };
  });
  return { ok: true, source, period, asOfMs: end, items };
}

async function settled(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function verifyChart(page, label, { fullscreen = false, tooltip = false } = {}) {
  await settled(page);
  const result = await page.evaluate(() => {
    const canvas = document.getElementById("c");
    const bounds = canvas.getBoundingClientRect();
    const card = document.getElementById("chartCard").getBoundingClientRect();
    const controls = document.getElementById("chartLineControls").getBoundingClientRect();
    const fs = document.getElementById("fsBtn").getBoundingClientRect();
    const frame = window.chartFrame;
    const pixels = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
    let coloredPixels = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3] && Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) - Math.min(pixels[i], pixels[i + 1], pixels[i + 2]) > 80) coloredPixels++;
    }
    return {
      width: innerWidth, height: innerHeight, canvasWidth: canvas.width, scrollWidth: document.documentElement.scrollWidth,
      bounds: bounds.toJSON(), card: card.toJSON(), controls: controls.toJSON(), coloredPixels,
      text: frame.text, lines: frame.lines,
      clippedText: frame.text.filter((t) => t.left < -0.5 || t.right > canvas.width + 0.5 || t.top < -0.5 || t.bottom > canvas.height + 0.5),
      legends: Array.from(document.querySelectorAll(".chartLineToggle")).map((el) => {
        const name = el.querySelector(".chartLineToggleName");
        const range = document.createRange();
        range.selectNodeContents(name);
        const bounds = el.getBoundingClientRect();
        const style = getComputedStyle(name);
        return {
          symbol: el.querySelector("input").dataset.lineSymbol, text: name.textContent,
          visible: style.display !== "none" && style.visibility !== "hidden" && name.getBoundingClientRect().width > 0,
          clipped: Array.from(range.getClientRects()).some((r) =>
            r.left < bounds.left - 1 || r.right > bounds.right + 1 || r.top < bounds.top - 1 || r.bottom > bounds.bottom + 1),
        };
      }),
      controlsOverlap: Array.from(document.querySelectorAll(".chartLineToggle")).some((el) => {
        const r = el.getBoundingClientRect();
        return r.left < fs.right && r.right > fs.left && r.top < fs.bottom && r.bottom > fs.top;
      }),
    };
  });
  assert.ok(result.scrollWidth <= result.width + 1, `${label}: page overflows horizontally`);
  assert.ok(result.bounds.left >= -1 && result.bounds.right <= result.width + 1, `${label}: chart extends outside viewport`);
  assert.ok(result.coloredPixels > 150, `${label}: missing chart lines`);
  assert.deepEqual(result.clippedText, [], `${label}: clipped canvas text`);
  assert.equal(result.controlsOverlap, false, `${label}: fullscreen button covers line controls`);
  for (const legend of result.legends) {
    assert.equal(legend.text, INDEXES.find((item) => item.symbol === legend.symbol)?.nameCN, `${label}: incomplete Chinese index name`);
    assert.equal(legend.visible, true, `${label}: Chinese index name is hidden`);
    assert.equal(legend.clipped, false, `${label}: Chinese index name is clipped`);
  }
  const timeLabels = result.text.filter((t) => /^\d{2}:\d{2}$|^\d{2}-\d{2}$|^\d{4}$/.test(t.text));
  assert.ok(timeLabels.length >= 2 && timeLabels.length <= 7, `${label}: time ticks missing`);
  for (let i = 1; i < timeLabels.length; i++) {
    assert.ok(timeLabels[i].left >= timeLabels[i - 1].right + 2, `${label}: time ticks overlap`);
  }
  assert.ok(result.lines.length >= 4, `${label}: incomplete index paths`);
  assert.ok(result.lines.every((line) => line.left >= 0 && line.right <= result.canvasWidth), `${label}: clipped index path`);
  if (fullscreen) {
    assert.ok(result.controls.bottom <= result.bounds.top + 1, `${label}: controls cover plot`);
    assert.ok(result.bounds.bottom <= result.height + 1, `${label}: fullscreen plot bottom clipped`);
    assert.ok(result.bounds.bottom >= result.card.bottom - 1, `${label}: fullscreen space unused`);
  }
  if (tooltip) assert.ok(result.text.some((t) => t.text.includes("时间")), `${label}: touch tooltip not shown`);
  checks++;
}

try {
  for (const viewport of [
    { width: 320, height: 740 }, { width: 360, height: 800 }, { width: 390, height: 844 },
    { width: 430, height: 932 }, { width: 740, height: 320 }, { width: 768, height: 1024 }, { width: 844, height: 390 },
    { width: 1024, height: 768 }, { width: 1440, height: 900 },
  ]) {
    const mobile = viewport.width <= 980;
    const context = await browser.newContext({ viewport, deviceScaleFactor: mobile ? 3 : 1, isMobile: mobile, hasTouch: mobile });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
      // Capture the last drawing frame so cropped glyphs are caught even when CSS fits.
      const proto = CanvasRenderingContext2D.prototype;
      const clear = proto.clearRect;
      const fillText = proto.fillText;
      const stroke = proto.stroke;
      const moveTo = proto.moveTo;
      const lineTo = proto.lineTo;
      const beginPath = proto.beginPath;
      proto.clearRect = function (...args) {
        if (this.canvas.id === "c") window.chartFrame = { text: [], lines: [] };
        return clear.apply(this, args);
      };
      proto.fillText = function (text, x, y, ...args) {
        if (this.canvas.id === "c" && window.chartFrame) {
          const m = this.measureText(text);
          window.chartFrame.text.push({ text, left: x - m.actualBoundingBoxLeft, right: x + m.actualBoundingBoxRight,
            top: y - m.actualBoundingBoxAscent, bottom: y + m.actualBoundingBoxDescent });
        }
        return fillText.call(this, text, x, y, ...args);
      };
      proto.beginPath = function (...args) { this.chartPoints = []; return beginPath.apply(this, args); };
      proto.moveTo = function (x, y) { this.chartPoints?.push({ x, y }); return moveTo.call(this, x, y); };
      proto.lineTo = function (x, y) { this.chartPoints?.push({ x, y }); return lineTo.call(this, x, y); };
      proto.stroke = function (...args) {
        if (this.canvas.id === "c" && this.chartPoints?.length > 10) {
          window.chartFrame.lines.push({ left: Math.min(...this.chartPoints.map((p) => p.x)), right: Math.max(...this.chartPoints.map((p) => p.x)) });
        }
        return stroke.apply(this, args);
      };
    });
    await page.route("**/api/**", async (route) => {
      const url = new URL(route.request().url());
      await route.fulfill({ json: url.pathname === "/api/quote"
        ? quoteFixture(url.searchParams.get("source"), url.searchParams.get("p")) : { ok: true } });
    });
    await page.goto(baseUrl);
    await page.locator(".chartLineToggle").first().waitFor();
    for (const source of ["yahoo", "google"]) {
      if (source === "google") {
        await page.locator('[data-index-source="google"]').click();
        await page.locator("#globalRefreshBtn").click();
      }
      for (const period of INDEX_DATA_SOURCES[source].periods) {
        await page.locator(`#seg [data-p="${period}"]`).click();
        await page.waitForFunction((p) => document.querySelector("#idxCurrentPeriod").textContent.endsWith(p),
          PERIOD_LABELS[period], { timeout: 5000 });
        await verifyChart(page, `${viewport.width}/${source}/${period}`);
      }
    }
    await page.locator("#c").scrollIntoViewIfNeeded();
    await page.locator("#c").dispatchEvent("pointerdown", { clientX: 120, clientY: (await page.locator("#c").boundingBox()).y + 100 });
    await verifyChart(page, `${viewport.width}/tooltip`, { tooltip: true });
    if (viewport.width === 390) await page.locator("#chartCard").screenshot({ path: fileURLToPath(new URL("mobile-portrait.png", outputDir)) });
    if (mobile) {
      // Force the iPhone fallback, then rotate without reloading or losing line preferences.
      await page.evaluate(() => { Object.defineProperty(document, "fullscreenEnabled", { configurable: true, value: false }); });
      await page.locator("#fsBtn").click();
      await verifyChart(page, `${viewport.width}/pseudo-fullscreen`, { fullscreen: true });
      await page.setViewportSize({ width: 844, height: 390 });
      await verifyChart(page, `${viewport.width}/rotated-fullscreen`, { fullscreen: true });
      await page.locator("#fsBtn").click();
      await page.setViewportSize(viewport);
      await page.evaluate(() => { Object.defineProperty(document, "fullscreenEnabled", { configurable: true, value: true }); });
      await page.locator("#fsBtn").click();
      await page.waitForFunction(() => !!document.fullscreenElement);
      await verifyChart(page, `${viewport.width}/native-fullscreen`, { fullscreen: true });
      await page.locator("#fsBtn").click();
    }
    await page.locator(".chartLineToggle").first().click();
    assert.equal(await page.locator(".chartLineToggleInput").first().isChecked(), false);
    await page.reload();
    await page.locator(".chartLineToggle").first().waitFor();
    assert.equal(await page.locator(".chartLineToggleInput").first().isChecked(), false, "line preference lost after reload");
    assert.deepEqual(errors, [], `browser errors at ${viewport.width}`);
    console.log(`PASS ${viewport.width}x${viewport.height}`);
    await context.close();
  }
  console.log(`PASS ${checks} responsive chart checks`);
} finally {
  await browser.close();
}
