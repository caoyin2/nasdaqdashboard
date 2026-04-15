/**
 * Build the payload for the fund premium/discount panel.
 *
 * This panel intentionally does not use KV metadata. The fund list is small,
 * stable, and locally configured in config.js, while live quote data comes
 * from Tencent Finance's classic qt.gtimg.cn endpoint.
 *
 * Tencent qt response format:
 *   v_sz161128="51~name~code~last~prevClose~open~...~time~change~changePct~..."
 *
 * Important field indexes used here:
 * - 3: latest trading price
 * - 4: previous close
 * - 30: quote timestamp, formatted as yyyyMMddHHmmss in Beijing time
 * - 31: price change
 * - 32: price change percent
 * - 77: premium/discount percent shown by Tencent's fund page
 * - 78: reference NAV, kept for diagnostics only; premium display uses field 77
 */

import { FUND_PREMIUM_FUNDS, INDEXES } from "../config.js";
import { getLastBar, parseBarsFromAttributes, pickPrevCloseSmart } from "../lib/time.js";
import { fetchSeekingAlphaPeriod } from "./seekingAlpha.js";

const TENCENT_QT_URL = "https://qt.gtimg.cn/";
const LOF_SP500_TECH_CODE = "161128";
const SP500_TECH_INDEX_SYMBOL = "SP500-45";

function toMarketSymbol(code) {
  const value = String(code || "").trim();

  if (value.startsWith("51")) return `sh${value}`;
  if (value.startsWith("15") || value.startsWith("16")) return `sz${value}`;

  return value;
}

function toFiniteNumber(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const number = +value;
  return Number.isFinite(number) ? number : null;
}

function cleanName(value, fallback) {
  const text = String(value || "").trim();
  return text || fallback || "";
}

function parseTencentBeijingTime(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);
  if (!match) return null;

  const year = +match[1];
  const month = +match[2];
  const day = +match[3];
  const hour = +match[4];
  const minute = +match[5];
  const second = +match[6];

  // Tencent returns A-share quote timestamps in Beijing time. Convert them to
  // UTC milliseconds so the shared frontend Beijing formatter can display them
  // consistently with the other panels.
  const utcMs = Date.UTC(year, month - 1, day, hour - 8, minute, second);
  return Number.isFinite(utcMs) ? utcMs : null;
}

function parseQtVariables(text) {
  const map = new Map();
  const pattern = /v_([^=]+)="([^"]*)";/g;
  let match;

  while ((match = pattern.exec(text || ""))) {
    map.set(match[1], match[2].split("~"));
  }

  return map;
}

async function fetchSp500TechOneDayChangePct() {
  const index = INDEXES.find((item) => item.symbol === SP500_TECH_INDEX_SYMBOL);
  if (!index?.tickerId) {
    throw new Error(`${SP500_TECH_INDEX_SYMBOL} ticker_id missing`);
  }

  const [oneDayRaw, ytdRaw] = await Promise.all([
    fetchSeekingAlphaPeriod("1D", index.tickerId),
    fetchSeekingAlphaPeriod("YTD", index.tickerId),
  ]);

  const bars1D = parseBarsFromAttributes(oneDayRaw?.attributes);
  const ytdBars = parseBarsFromAttributes(ytdRaw?.attributes);
  const last1DBar = getLastBar(bars1D);
  const latestClose = last1DBar?.close;
  const baseClose = pickPrevCloseSmart(ytdBars, bars1D);
  const change = Number.isFinite(latestClose) && Number.isFinite(baseClose)
    ? latestClose - baseClose
    : null;
  const changePct = Number.isFinite(change) && Number.isFinite(baseClose) && baseClose !== 0
    ? (change / baseClose) * 100
    : null;

  if (!Number.isFinite(changePct)) {
    throw new Error(`${SP500_TECH_INDEX_SYMBOL} 1D change percent unavailable`);
  }

  return {
    symbol: SP500_TECH_INDEX_SYMBOL,
    changePct,
    latestT: Number.isFinite(last1DBar?.t) ? last1DBar.t : null,
  };
}

function buildFundItem(fund, fields, context) {
  const lastClose = toFiniteNumber(fields[3]);
  const baseClose = toFiniteNumber(fields[4]);
  const latestT = parseTencentBeijingTime(fields[30]);
  const change = toFiniteNumber(fields[31]);
  const changePct = toFiniteNumber(fields[32]);
  const premiumPctFromTencent = toFiniteNumber(fields[77]);
  const premiumReferenceNav = toFiniteNumber(fields[78]);
  let premiumPct = premiumPctFromTencent;
  let premiumFormula = null;

  if (fund.code === LOF_SP500_TECH_CODE && Number.isFinite(premiumPctFromTencent)) {
    const indexChangePct = context?.sp500TechOneDay?.changePct;
    if (Number.isFinite(indexChangePct)) {
      premiumPct = premiumPctFromTencent - indexChangePct;
      premiumFormula = {
        rawPct: premiumPctFromTencent,
        indexSymbol: SP500_TECH_INDEX_SYMBOL,
        indexChangePct,
        indexLatestT: context?.sp500TechOneDay?.latestT ?? null,
        resultPct: premiumPct,
      };
    }
  }

  return {
    symbol: fund.marketSymbol,
    code: fund.code,
    nameCN: cleanName(fields[1], fund.fallbackName),
    icon: fund.icon || null,
    latestT,
    period: "1D",
    baseLabel: "\u6628\u6536",
    lastClose,
    baseClose,
    change,
    changePct,
    premiumPct,
    premiumRawPct: premiumPctFromTencent,
    premiumReferenceNav,
    premiumFormula,
  };
}

function maxLatestTime(items) {
  const values = (items || [])
    .map((item) => item?.latestT)
    .filter((value) => Number.isFinite(value));

  return values.length ? Math.max(...values) : null;
}

export async function buildFundPremiumPayload() {
  const funds = FUND_PREMIUM_FUNDS.map((fund) => ({
    ...fund,
    marketSymbol: toMarketSymbol(fund.code),
  }));

  const url = new URL(TENCENT_QT_URL);
  url.searchParams.set("q", funds.map((fund) => fund.marketSymbol).join(","));
  url.searchParams.set("_", `${Date.now()}-${Math.random().toString(36).slice(2)}`);

  const response = await fetch(url.toString(), {
    headers: {
      Referer: "https://gu.qq.com/sz161128",
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
  const variableMap = parseQtVariables(text);

  const sp500TechOneDay = await fetchSp500TechOneDayChangePct();
  const items = funds.map((fund) => {
    const fields = variableMap.get(fund.marketSymbol);
    if (!fields || fields.length <= 77) {
      throw new Error(`Tencent fund quote missing or incomplete for ${fund.marketSymbol}`);
    }

    return buildFundItem(fund, fields, { sp500TechOneDay });
  });

  return {
    ok: true,
    title: "\u57fa\u91d1\u6298\u6ea2\u4ef7\uff08\u5f00\u53d1\u4e2d\uff09",
    asOfMs: maxLatestTime(items),
    items,
  };
}
