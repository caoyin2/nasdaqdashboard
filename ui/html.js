import {
  DOWN_COLOR,
  INDEXES,
  LINE_COLORS,
  PERIOD_LABELS,
  UP_COLOR,
} from "../config.js";
import { getStyles } from "./styles.js";

function safeJsonForHtml(data) {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

export function getHtml() {
  const meta = INDEXES.map((item, index) => ({
    ...item,
    color: LINE_COLORS[index % LINE_COLORS.length],
  }));

  const appConfig = {
    meta,
    periodLabels: PERIOD_LABELS,
    upColor: UP_COLOR,
    downColor: DOWN_COLOR,
  };

  const nasdaqLogoUrl =
    "https://companieslogo.com/img/orig/NDAQ-0d58bfbc.svg?t=1740420328&download=true";
  const nasdaqFaviconUrl =
    "https://www.nasdaq.com/sites/acquia.prod/files/favicon.ico";

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1, viewport-fit=cover" />
  <title>\u7eb3\u65af\u8fbe\u514b\u6307\u6570\u770b\u677f</title>
  <link rel="icon" href="${nasdaqFaviconUrl}" />
  <style>${getStyles()}</style>
</head>
<body>
  <div class="wrap">
    <div class="top">
      <div class="brand">
        <img class="logo" src="${nasdaqLogoUrl}" alt="NASDAQ" />
        <div class="title">
          <div class="h">\u7eb3\u65af\u8fbe\u514b\u6307\u6570\u770b\u677f</div>
          <div class="sub" id="periodCN">\u9762\u677f\uff1a\u79d1\u6280\u7c7b\u6307\u6570\u4fe1\u606f</div>
        </div>
      </div>
    </div>

    <div class="pageSeg" id="pageSeg" aria-label="\u9875\u9762\u5207\u6362">
      <button class="active" data-page="overview">\u79d1\u6280\u7c7b\u6307\u6570\u4fe1\u606f</button>
      <button data-page="stars">\u660e\u661f\u79d1\u6280\u516c\u53f8</button>
      <button data-page="weights">\u79d1\u6280\u7c7b\u6307\u6570\u6743\u91cd</button>
    </div>

    <div class="pages" id="pages">
      <section class="page page-active" data-page="overview">
        <div class="grid">
          <div class="card chart chartCard" id="chartCard">
            <div class="fsHint" id="fsHint">
              \u5df2\u8fdb\u5165\u5168\u5c4f\u6a21\u5f0f\u3002iPhone Safari \u4e0d\u652f\u6301\u5f3a\u5236\u9501\u6a2a\u5c4f\uff0c\u8bf7\u624b\u52a8\u65cb\u8f6c\u8bbe\u5907\uff1b\u518d\u6b21\u70b9\u51fb\u53f3\u4e0a\u89d2\u6309\u94ae\u9000\u51fa\u3002
            </div>

            <button class="fsBtn" id="fsBtn" aria-label="\u5168\u5c4f\u6a2a\u5c4f\u67e5\u770b">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M7 14H5v5h5v-2H7v-3zm0-4h2V7h3V5H5v5zm10 9h-3v2h5v-5h-2v3zm0-14V5h-5v2h3v3h2V5z"/>
              </svg>
            </button>

            <div class="chartWrap">
              <canvas id="c"></canvas>
            </div>

            <div class="footer">
              <div class="status ok" id="status">\u52a0\u8f7d\u4e2d\u2026</div>
              <div id="hint">\u60ac\u6d6e\u6216\u62d6\u52a8\u67e5\u770b\u6570\u636e\uff08\u5317\u4eac\u65f6\u95f4\uff09</div>
            </div>
          </div>

          <div class="card info">
            <div class="right">
              <div id="fearGreedCard"></div>

              <div class="seg" id="seg">
                <button data-p="1D" class="active">${PERIOD_LABELS["1D"]}</button>
                <button data-p="5D">${PERIOD_LABELS["5D"]}</button>
                <button data-p="1M">${PERIOD_LABELS["1M"]}</button>
                <button data-p="6M">${PERIOD_LABELS["6M"]}</button>
                <button data-p="YTD">${PERIOD_LABELS["YTD"]}</button>
                <button data-p="1Y">${PERIOD_LABELS["1Y"]}</button>
              </div>

              <div class="blockTitle">\u6307\u6570</div>
              <div id="idxCards"></div>
            </div>
          </div>
        </div>
      </section>

      <section class="page page-stars" data-page="stars">
        <div id="starTechPanel"></div>
      </section>

      <section class="page page-weights" data-page="weights">
        <div id="indexWeightsPanel"></div>
      </section>
    </div>
  </div>

  <script id="app-config" type="application/json">${safeJsonForHtml(appConfig)}</script>
  <script src="/app.js"></script>
</body>
</html>`;
}
