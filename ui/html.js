/**
 * 首页 HTML 模板。
 *
 * 这个文件只负责输出页面骨架，不处理业务数据。
 * 页面里的动态内容由前端脚本在浏览器端填充：
 * - 指数折线图
 * - CNN 恐惧贪婪指数仪表盘
 * - 右侧指数卡片
 *
 * 这样拆分后，后续如果只想改布局或文案，只需要改这个文件。
 */

import {
  DOWN_COLOR,
  INDEXES,
  LINE_COLORS,
  PERIOD_LABELS,
  UP_COLOR,
} from "../config.js";
import { getClientScript } from "./client.js";
import { getStyles } from "./styles.js";

/**
 * 把 JSON 安全地嵌入到 HTML 中，避免被当作标签解析。
 */
function safeJsonForHtml(data) {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

/**
 * 防止内联脚本中出现 </script> 时提前结束脚本标签。
 */
function safeInlineScript(js) {
  return js.replace(/<\/script/gi, "<\\/script");
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

  const NASDAQ_LOGO_URL =
    "https://companieslogo.com/img/orig/NDAQ-0d58bfbc.svg?t=1740420328&download=true";
  const NASDAQ_FAVICON_URL =
    "https://www.nasdaq.com/sites/acquia.prod/files/favicon.ico";

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1, viewport-fit=cover" />
  <title>纳斯达克指数看板</title>
  <link rel="icon" href="${NASDAQ_FAVICON_URL}" />
  <style>${getStyles()}</style>
</head>

<body>
  <div class="wrap">
    <div class="top">
      <div class="brand">
        <img class="logo" src="${NASDAQ_LOGO_URL}" alt="NASDAQ" />
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

      <div class="asof" id="asOf">--</div>
    </div>

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
          <div class="status ok" id="status">加载中…</div>
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
  </div>

  <script id="app-config" type="application/json">${safeJsonForHtml(appConfig)}</script>
  <script>${safeInlineScript(getClientScript())}</script>
</body>
</html>`;
}
