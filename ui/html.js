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
  <title>纳斯达克指数看板</title>
  <link rel="icon" href="${nasdaqFaviconUrl}" />
  <style>${getStyles()}</style>
</head>
<body>
  <div class="wrap">
    <div class="top">
      <div class="brand">
        <img class="logo" src="${nasdaqLogoUrl}" alt="NASDAQ" />
        <div class="title">
          <div class="h">纳斯达克指数看板</div>
          <div class="sub" id="periodCN">周期：${PERIOD_LABELS["1D"]}</div>
        </div>

        <div class="seg" id="seg">
          <button data-p="1D" class="active">${PERIOD_LABELS["1D"]}</button>
          <button data-p="5D">${PERIOD_LABELS["5D"]}</button>
          <button data-p="1M">${PERIOD_LABELS["1M"]}</button>
          <button data-p="6M">${PERIOD_LABELS["6M"]}</button>
          <button data-p="YTD">${PERIOD_LABELS["YTD"]}</button>
          <button data-p="1Y">${PERIOD_LABELS["1Y"]}</button>
        </div>
      </div>
    </div>

    <div class="pageSeg" id="pageSeg" aria-label="桌面分页">
      <button class="active" data-page="overview">科技类指数信息</button>
      <button data-page="stars">明星科技公司</button>
    </div>

    <div class="pages" id="pages">
      <section class="page page-active" data-page="overview">
        <div class="grid">
          <div class="card chart chartCard" id="chartCard">
            <div class="fsHint" id="fsHint">
              已进入全屏模式。iPhone Safari 不支持强制锁横屏，请手动旋转设备；再次点击右上角按钮退出。
            </div>

            <button class="fsBtn" id="fsBtn" aria-label="全屏横屏查看">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M7 14H5v5h5v-2H7v-3zm0-4h2V7h3V5H5v5zm10 9h-3v2h5v-5h-2v3zm0-14V5h-5v2h3v3h2V5z"/>
              </svg>
            </button>

            <div class="chartWrap">
              <canvas id="c"></canvas>
            </div>

            <div class="footer">
              <div class="status ok" id="status">加载中...</div>
              <div id="hint">悬浮或拖动查看数据（北京时间）</div>
            </div>
          </div>

          <div class="card info">
            <div class="right">
              <div id="fearGreedCard"></div>
              <div class="blockTitle">指数</div>
              <div id="idxCards"></div>
            </div>
          </div>
        </div>
      </section>

      <section class="page page-stars" data-page="stars">
        <div id="starTechPanel"></div>
      </section>
    </div>
  </div>

  <script id="app-config" type="application/json">${safeJsonForHtml(appConfig)}</script>
  <script src="/app.js"></script>
</body>
</html>`;
}
