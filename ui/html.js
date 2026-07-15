import {
  DOWN_COLOR,
  INDEX_DATA_SOURCES,
  INDEXES,
  LINE_COLORS,
  PERIOD_LABELS,
  UP_COLOR,
} from "../config.js";
import { BUILD_INFO } from "./buildInfo.js";
import { getStyles } from "./styles.js";

function safeJsonForHtml(data) {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

function safeTextForHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const NASDAQ_LOGO_SVG = `<svg class="logo" role="img" aria-label="NASDAQ" fill="none" viewBox="0 0 100 29" xmlns="http://www.w3.org/2000/svg">
  <clipPath id="nasdaqLogoClip"><path d="m.166992.944336h99v28h-99z"/></clipPath>
  <g clip-path="url(#nasdaqLogoClip)" clip-rule="evenodd" fill-rule="evenodd">
    <path d="m73.136 22.2485c-3.3782 0-5.4768-1.9609-5.4768-5.1193 0-3.2816 1.9361-5.321 5.0546-5.321l.2634-.0018c.3904 0 .9283.0121 1.6643.1064v-3.96016h2.206v13.93936s-2.0949.3565-3.7115.3565zm-.0187-8.7015c-2.1351 0-3.1727 1.1536-3.1727 3.528 0 2.129 1.2515 3.4524 3.2642 3.4524.3867 0 .8294-.0242 1.4327-.0774v-6.762c-.5036-.0871-1.0132-.1343-1.5242-.141zm-30.1651 8.3832-5.9522-10.4094-.0018 10.4094h-2.0744v-13.17583h2.9028l5.954 10.31613-.0028-10.31613h2.1014v13.17583zm18.9603.2016c-1.0021 0-2.0472-.112-3.2922-.3518l-.1326-.0262v-1.8405l.1971.0429c1.0964.2334 2.0435.4359 2.9896.4359.7668 0 2.5497-.1223 2.5497-1.2507 0-.9464-1.2328-1.1834-2.2228-1.3729l-.0617-.0131c-.1699-.032-.339-.0681-.5071-.1082-1.4514-.3771-2.999-.9436-2.999-2.8934 0-1.8993 1.5018-2.9894 4.1197-2.9894 1.2571 0 2.1696.1353 2.9019.2445l.3586.0541v1.7836l-.1915-.0326c-.8293-.1531-1.8016-.3099-2.7383-.3099-1.0377 0-2.2742.1941-2.2742 1.1219 0 .7681 1.0105.9884 2.1808 1.2432 1.6344.3565 3.6639.7998 3.6639 3.0352 0 2.0514-1.6559 3.2274-4.5419 3.2274zm21.1216 0c-2.2836 0-4.3952-.4013-4.3952-3.3189 0-3.1752 3.267-3.1752 5.2189-3.1752.1952 0 1.1124.042 1.3954.0541-.0028-1.7808-.0271-2.2054-2.6048-2.2054-1.0218 0-2.1575.2034-3.1596.3826l-.1915.0346v-1.7603l.1308-.0261c1.1256-.2338 2.2723-.352 3.422-.3528 2.4993 0 4.6166.252 4.6166 3.3572v6.7741l-.1523.0149c-1.4212.1572-2.8504.2311-4.2803.2212zm.7686-4.9242c-1.8828 0-3.0484.2772-3.0484 1.6585 0 1.5988 1.4887 1.7323 2.8841 1.7323.523 0 1.4597-.0663 1.7465-.0878v-3.248c-.4044-.0158-1.4551-.055-1.5822-.055zm-31.6902 4.9242c-2.2836 0-4.3953-.4013-4.3953-3.3189 0-3.1752 3.267-3.1752 5.219-3.1752.1952 0 1.1124.042 1.3954.0541-.0028-1.7808-.0262-2.2054-2.6049-2.2054-1.0217 0-2.1574.2034-3.1596.3826l-.1914.0346v-1.7603l.1307-.0261c1.1257-.2338 2.2724-.352 3.4221-.3528 2.4993 0 4.6166.252 4.6166 3.3572v6.7741l-.1523.0149c-1.4212.1572-2.8505.2311-4.2803.2212zm.7686-4.9242c-1.8828 0-3.0484.2772-3.0484 1.6585 0 1.5988 1.4887 1.7323 2.884 1.7323.5231 0 1.4598-.0663 1.7465-.0878v-3.248c-.4044-.0158-1.4551-.055-1.5821-.055zm43.3611 9.198v-4.3214c-.8611.1214-1.3188.1214-1.6877.1214-.8723 0-1.8418-.1904-2.5936-.5096-1.6783-.6982-2.6805-2.4762-2.6805-4.7572 0-1.1396.2765-3.22 2.1295-4.3428.9274-.5563 2.0267-.7934 3.676-.7934.5922 0 1.3898.0448 2.1603.0896l1.2515.0654v13.4474zm-1.3216-12.8642c-2.2377 0-3.3734 1.1434-3.3734 3.3974 0 2.9008 1.6951 3.5093 3.1175 3.5093.3456 0 .736 0 1.598-.1092v-6.7349c-.4465-.0368-.8941-.0577-1.3421-.0626z" fill="#fff"/>
    <path d="m25.0786.944336-7.2896 20.062964c-.1793.4946-.6314.8568-1.1731.9109v.0121h7.7052c.6043 0 1.1208-.3845 1.3141-.923l7.2896-20.062964zm-9.0903 20.679864c.4446 0 .8368-.2212 1.0769-.5581.0252-.0346.112-.1587.1737-.3267l2.6739-7.3603-1.5634-4.29983c-.0914-.21706-.2391-.4058-.4279-.54673-.1888-.14092-.4118-.22892-.646-.25489-.2342-.02598-.4711.01101-.6863.10714-.2151.09614-.4006.24792-.5374.43968-.0715.10111-.1298.21087-.1737.32667l-2.673 7.35836 1.57 4.3158c.2036.4694.6696.7989 1.2132.7989zm-7.21765-13.66493h7.78925v.00467c-.2768.01111-.5441.10429-.7678.26767s-.3937.38957-.4884.64979l-7.28956 20.0629h-7.847148l7.289578-20.0629c.19426-.5376.70981-.92213 1.31408-.92213z" fill="#0092bc"/>
  </g>
</svg>`;

const YAHOO_TAIWAN_SOURCE_ICON_SVG = `<svg class="indexSourceIcon indexSourceYahoo" viewBox="0 0 20 20" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
  <rect width="20" height="20" rx="4" fill="#6001d2"/>
  <text x="10" y="13.25" text-anchor="middle" fill="#fff" font-family="Arial, sans-serif" font-size="10.5" font-weight="700">Y!</text>
</svg>`;

const GOOGLE_FINANCE_SOURCE_ICON_SVG = `<svg class="indexSourceIcon indexSourceGoogle" viewBox="0 0 24 24" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
  <path fill="#4285f4" d="M21.35 12.27c0-.79-.07-1.55-.2-2.27H12v4.3h5.23a4.47 4.47 0 0 1-1.94 2.93v2.77h3.58c2.09-1.93 3.3-4.77 3.3-7.73z"/>
  <path fill="#34a853" d="M12 21.5c2.7 0 4.96-.9 6.61-2.5l-3.58-2.77c-.99.66-2.26 1.05-3.73 1.05-2.87 0-5.3-1.94-6.17-4.55H1.42v2.84A9.98 9.98 0 0 0 12 21.5z"/>
  <path fill="#fbbc05" d="M5.83 12.73a6 6 0 0 1 0-3.46V6.43H1.42a9.99 9.99 0 0 0 0 9.14l4.41-2.84z"/>
  <path fill="#ea4335" d="M12 5.94c1.57 0 2.97.54 4.08 1.61l3.06-3.06C16.95 2.45 14.7 1.5 12 1.5A9.98 9.98 0 0 0 1.42 6.43l4.41 2.84C6.7 7.88 9.13 5.94 12 5.94z"/>
</svg>`;

export function getHtml() {
  const meta = INDEXES.map((item, index) => ({
    ...item,
    color: LINE_COLORS[index % LINE_COLORS.length],
  }));

  const appConfig = {
    meta,
    periodLabels: PERIOD_LABELS,
    indexSources: Object.values(INDEX_DATA_SOURCES),
    upColor: UP_COLOR,
    downColor: DOWN_COLOR,
  };
  const yahooPeriods = INDEX_DATA_SOURCES.yahoo.periods;
  const sourceKeysForPeriod = (period) =>
    Object.values(INDEX_DATA_SOURCES)
      .filter((source) => source.periods.includes(period))
      .map((source) => source.key)
      .join(",");

  const nasdaqFaviconUrl =
    "https://www.nasdaq.com/sites/acquia.prod/files/favicon.ico";
  const versionId = BUILD_INFO.version || BUILD_INFO.shortSha || "local";
  const versionTitle = [BUILD_INFO.fullSha, BUILD_INFO.message].filter(Boolean).join(" | ");

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
        ${NASDAQ_LOGO_SVG}
        <div class="title">
          <div class="titleHead">
            <div class="h">\u7eb3\u65af\u8fbe\u514b\u6307\u6570\u770b\u677f</div>
            <button class="globalRefreshBtn" id="globalRefreshBtn" type="button" aria-label="\u5237\u65b0\u5f53\u524d\u9762\u677f\u6570\u636e">\u5237\u65b0</button>
          </div>
          <div class="sub" id="periodCN">\u9762\u677f\uff1a\u79d1\u6280\u7c7b\u6307\u6570\u4fe1\u606f</div>
        </div>
      </div>
      <div class="buildInfo" title="${safeTextForHtml(versionTitle)}">
        <div class="buildInfoLine">\u7248\u672c\uff1a${safeTextForHtml(versionId)}</div>
        <div class="buildInfoSubline">${safeTextForHtml(BUILD_INFO.message || "")}</div>
      </div>
    </div>

    <div class="pageSeg" id="pageSeg" aria-label="\u9875\u9762\u5207\u6362">
      <button class="active" data-page="overview">\u79d1\u6280\u7c7b\u6307\u6570\u4fe1\u606f</button>
      <button data-page="fundPremiums">\u57fa\u91d1\u6298\u6ea2\u4ef7</button>
      <button data-page="stars">\u660e\u661f\u79d1\u6280\u516c\u53f8</button>
      <button data-page="weights">\u79d1\u6280\u7c7b\u6307\u6570\u6743\u91cd</button>
      <button data-page="sectors">\u6807\u666e500\u677f\u5757ETF</button>
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
              <div id="hint">\u60ac\u6d6e\u6216\u62d6\u52a8\u67e5\u770b\u6570\u636e\uff08\u5317\u4eac\u65f6\u95f4\uff09</div>
            </div>
          </div>

          <div class="card info">
            <div class="right">
              <div id="fearGreedCard"></div>

              <div class="indexSourceSeg" id="indexSourceSeg" aria-label="指数数据来源">
                <button data-index-source="yahoo" class="active" type="button" title="雅虎台湾数据验证中">
                  ${YAHOO_TAIWAN_SOURCE_ICON_SVG}
                  <span>雅虎台湾（<b class="indexSourceHealth" data-index-source-health="yahoo">…</b>）</span>
                </button>
                <button data-index-source="google" type="button" title="谷歌财经数据验证中">
                  ${GOOGLE_FINANCE_SOURCE_ICON_SVG}
                  <span>谷歌财经（<b class="indexSourceHealth" data-index-source-health="google">…</b>）</span>
                </button>
              </div>

              <div class="seg" id="seg">
                ${yahooPeriods.map((period) => `<button data-p="${period}" data-sources="${sourceKeysForPeriod(period)}" class="${period === "1D" ? "active" : ""}">${PERIOD_LABELS[period]}</button>`).join("")}
              </div>

              <div class="overviewMeta">
                <div class="starPanelMetaText status ok" id="status" data-meta-status="1">\u52a0\u8f7d\u4e2d\u2026</div>
                <div class="starPanelMetaText" id="idxCurrentPeriod">\u5f53\u524d\u5468\u671f\uff1a${PERIOD_LABELS["1D"]}</div>
                <div class="starPanelMetaText overviewLatestTime" id="idxLatestTime"></div>
              </div>
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

      <section class="page page-sectors" data-page="sectors">
        <div id="sp500SectorPanel"></div>
      </section>

      <section class="page page-fund-premiums" data-page="fundPremiums">
        <div id="fundPremiumPanel"></div>
      </section>
    </div>
  </div>

  <script id="app-config" type="application/json">${safeJsonForHtml(appConfig)}</script>
  <script src="/app.js"></script>
</body>
</html>`;
}
