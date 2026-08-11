/**
 * Tencent Finance fund quote helpers shared by list validation and rendering.
 */

export const TENCENT_FUND_QUOTE_URL = "https://qt.gtimg.cn/";

export function toTencentFundMarketSymbol(code) {
  const value = String(code || "").trim();

  if (/^[569]/.test(value)) return `sh${value}`;
  if (/^[0123]/.test(value)) return `sz${value}`;

  return value;
}

function parseTencentQuoteVariables(text) {
  const map = new Map();
  const pattern = /v_([^=]+)="([^"]*)";/g;
  let match;

  while ((match = pattern.exec(text || ""))) {
    map.set(match[1], match[2].split("~"));
  }

  return map;
}

export function hasTencentFundQuote(fields) {
  if (!Array.isArray(fields) || fields.length <= 77) return false;
  const latestPrice = String(fields[3] ?? "").trim();
  return latestPrice !== "" && Number.isFinite(+latestPrice) && +latestPrice > 0;
}

export async function fetchTencentFundQuoteFields(marketSymbols) {
  const symbols = [...new Set((marketSymbols || []).map((symbol) => String(symbol || "").trim()).filter(Boolean))];
  if (!symbols.length) return new Map();

  const url = new URL(TENCENT_FUND_QUOTE_URL);
  url.searchParams.set("q", symbols.join(","));
  url.searchParams.set("_", `${Date.now()}-${Math.random().toString(36).slice(2)}`);

  const response = await fetch(url.toString(), {
    headers: {
      Referer: "https://gu.qq.com/",
      "User-Agent": "Mozilla/5.0 NasdaqDashboard/1.0",
    },
    cf: {
      cacheTtl: 0,
      cacheEverything: false,
    },
  });

  if (!response.ok) {
    throw new Error(`Tencent fund quote request failed: HTTP ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  let text;
  try {
    text = new TextDecoder("gbk").decode(buffer);
  } catch {
    text = new TextDecoder().decode(buffer);
  }

  return parseTencentQuoteVariables(text);
}
