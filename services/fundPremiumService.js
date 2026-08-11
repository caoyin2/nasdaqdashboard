/**
 * Build the payload for the fund premium/discount panel.
 *
 * The fund list is stored in Worker KV, with config.js providing the initial
 * seed and fallback. Live quote data comes from Tencent Finance's classic
 * qt.gtimg.cn endpoint.
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
 * - 78: reference NAV, kept for diagnostics only
 */

import { INDEXES } from "../config.js";
import { FUND_LOGOS } from "../assets/fundLogos.js";
import { marketDateKey } from "../lib/time.js";
import { getFundPremiumFundList } from "./fundPremiumListStore.js";
import { fetchIndexPeriodBySource, indexDataSourceLabel } from "./indexDataSource.js";

const TENCENT_QT_URL = "https://qt.gtimg.cn/";
const TENCENT_FUND_PRICE_ZONE_URL = "https://web.ifzq.gtimg.cn/fund/newfund/fundBase/getPriceZone";
const CHINA_MONEY_USD_CNY_URL = "https://www.chinamoney.com.cn/ags/ms/cm-u-bk-ccpr/CcprHisNew";
const LOF_SP500_TECH_CODE = "161128";
const SP500_TECH_INDEX_SYMBOL = "SP500-45";
const LOF_INDEX_DATA_SOURCE = "google";

function toMarketSymbol(code) {
  const value = String(code || "").trim();

  if (/^[569]/.test(value)) return `sh${value}`;
  if (/^[0123]/.test(value)) return `sz${value}`;

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

function parseTencentBeijingDateKey(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{4})(\d{2})(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

function latestTradeDate(items) {
  const values = (items || [])
    .map((item) => item?.tradeDate)
    .filter(Boolean)
    .sort();

  return values.length ? values[values.length - 1] : null;
}

function normalizeDateKey(value) {
  const text = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  if (/^\d{8}$/.test(text)) return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
  return null;
}

function addDays(dateKey, days) {
  const [year, month, day] = String(dateKey || "").split("-").map(Number);
  if (![year, month, day].every(Number.isFinite)) return null;
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(
    date.getUTCDate()
  ).padStart(2, "0")}`;
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

function pickOnOrBefore(rows, targetDate, dateSelector) {
  const target = normalizeDateKey(targetDate);
  if (!target) return null;

  const sorted = (rows || [])
    .map((row) => ({ row, date: normalizeDateKey(dateSelector(row)) }))
    .filter((item) => item.date && item.date <= target)
    .sort((a, b) => a.date.localeCompare(b.date));

  return sorted.length ? sorted[sorted.length - 1] : null;
}

async function fetchSp500TechDailyContext(navDate, tradeDate) {
  const index = INDEXES.find((item) => item.symbol === SP500_TECH_INDEX_SYMBOL);
  if (!index) {
    throw new Error(`${SP500_TECH_INDEX_SYMBOL} index configuration missing`);
  }

  const period = "YTD";
  const raw = await fetchIndexPeriodBySource(LOF_INDEX_DATA_SOURCE, period, index);
  const bars = (raw?.bars || [])
    .filter((bar) => Number.isFinite(bar?.close) && bar.close > 0)
    .map((bar) => ({
      date: marketDateKey(bar.t),
      close: bar.close,
      t: bar.t,
    }));

  const navPoint = pickOnOrBefore(bars, navDate, (bar) => bar.date);
  const tradePoint = pickOnOrBefore(bars, tradeDate, (bar) => bar.date);

  if (!navPoint || !tradePoint || !Number.isFinite(navPoint.row.close) || !Number.isFinite(tradePoint.row.close)) {
    throw new Error(`${SP500_TECH_INDEX_SYMBOL} daily close unavailable for ${navDate} to ${tradeDate}`);
  }

  return {
    symbol: SP500_TECH_INDEX_SYMBOL,
    tickerId: index.tickerId,
    dataSource: LOF_INDEX_DATA_SOURCE,
    source: indexDataSourceLabel(LOF_INDEX_DATA_SOURCE),
    yahooSymbol: index.yahooSymbol || null,
    googleSymbol: index.googleSymbol || index.symbol,
    googleExchange: index.googleExchange,
    googleQuote: raw.googleQuote || null,
    yahooQuote: raw.yahooSymbol || index.yahooSymbol || null,
    period,
    requestUrl: raw.pageUrl || raw.requestUrl || null,
    requestedNavDate: navDate,
    requestedTradeDate: tradeDate,
    navDate: navPoint.date,
    navClose: navPoint.row.close,
    navTime: navPoint.row.t,
    tradeDate: tradePoint.date,
    tradeClose: tradePoint.row.close,
    tradeTime: tradePoint.row.t,
    changePct: (tradePoint.row.close / navPoint.row.close - 1) * 100,
  };
}

async function fetchUsdCnyContext(navDate, tradeDate) {
  const startDate = addDays(navDate, -14) || navDate;
  const url = new URL(CHINA_MONEY_USD_CNY_URL);
  url.searchParams.set("startDate", startDate);
  url.searchParams.set("endDate", tradeDate);
  url.searchParams.set("currency", "USD/CNY");
  url.searchParams.set("pageNum", "1");
  url.searchParams.set("pageSize", "30");

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json, text/plain, */*",
      Referer: "https://www.chinamoney.com.cn/",
      "User-Agent": "Mozilla/5.0 NasdaqDashboard/1.0",
    },
    cf: {
      cacheTtl: 0,
      cacheEverything: false,
    },
  });

  if (!response.ok) {
    throw new Error(`ChinaMoney USD/CNY request failed: HTTP ${response.status}`);
  }

  const json = await response.json();
  const rows = Array.isArray(json?.records)
    ? json.records
        .map((record) => ({
          date: normalizeDateKey(record?.date),
          rate: toFiniteNumber(record?.values?.[0]),
        }))
        .filter((record) => record.date && Number.isFinite(record.rate))
    : [];
  const navRate = pickOnOrBefore(rows, navDate, (row) => row.date);
  const tradeRate = pickOnOrBefore(rows, tradeDate, (row) => row.date);

  if (!navRate || !tradeRate) {
    throw new Error(`USD/CNY central parity unavailable for ${navDate} to ${tradeDate}`);
  }

  return {
    source: "ChinaMoney USD/CNY central parity",
    requestUrl: url.toString(),
    requestedStartDate: startDate,
    requestedNavDate: navDate,
    requestedTradeDate: tradeDate,
    navDate: navRate.date,
    navRate: navRate.row.rate,
    tradeDate: tradeRate.date,
    tradeRate: tradeRate.row.rate,
    changePct: (tradeRate.row.rate / navRate.row.rate - 1) * 100,
  };
}

async function fetchLofBaseInfo(marketSymbol) {
  const url = new URL(TENCENT_FUND_PRICE_ZONE_URL);
  url.searchParams.set("symbol", marketSymbol);
  url.searchParams.set("_", `${Date.now()}-${Math.random().toString(36).slice(2)}`);

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json, text/plain, */*",
      Referer: `https://gu.qq.com/${marketSymbol}`,
      "User-Agent": "Mozilla/5.0 NasdaqDashboard/1.0",
    },
    cf: {
      cacheTtl: 0,
      cacheEverything: false,
    },
  });

  if (!response.ok) {
    throw new Error(`Tencent LOF base request failed: HTTP ${response.status}`);
  }

  const json = await response.json();
  if (json?.code !== 0 || !json?.data?.info) {
    throw new Error(`Tencent LOF base request invalid for ${marketSymbol}`);
  }

  return json.data;
}

async function buildLofPremiumContext(fund, fields) {
  // 161128 is a QDII-LOF. Tencent's own premium field is based on the last
  // published NAV. Any estimate must advance the index and the FX rate to the
  // same overseas valuation date. Using the domestic quote date for FX can
  // otherwise apply a newer exchange rate to an already-valued NAV.
  const tradePrice = toFiniteNumber(fields[3]);
  const tradeDate = parseTencentBeijingDateKey(fields[30]);
  const quoteTime = parseTencentBeijingTime(fields[30]);
  const baseInfo = await fetchLofBaseInfo(fund.marketSymbol);
  const publishedNav = toFiniteNumber(baseInfo?.info?.dwjz) ?? toFiniteNumber(baseInfo?.data?.jjdwjz) ?? toFiniteNumber(fields[81]);
  const publishedNavDate = normalizeDateKey(baseInfo?.info?.jzrq);
  const tencentPremiumPct = toFiniteNumber(fields[77]);
  const tencentReferenceNav = toFiniteNumber(fields[78]);

  if (!Number.isFinite(tradePrice) || !tradeDate || !Number.isFinite(publishedNav) || !publishedNavDate) {
    throw new Error(`LOF premium input incomplete for ${fund.marketSymbol}`);
  }

  const index = await fetchSp500TechDailyContext(publishedNavDate, tradeDate);
  const fx = await fetchUsdCnyContext(publishedNavDate, index.tradeDate);

  const indexMultiplier = index.tradeClose / index.navClose;
  const fxMultiplier = fx.tradeRate / fx.navRate;
  const estimatedNav = publishedNav * indexMultiplier * fxMultiplier;
  const premiumPct = Number.isFinite(estimatedNav) && estimatedNav !== 0
    ? (tradePrice / estimatedNav - 1) * 100
    : null;

  if (!Number.isFinite(premiumPct)) {
    throw new Error(`LOF premium calculation failed for ${fund.marketSymbol}`);
  }

  return {
    generatedAt: new Date().toISOString(),
    tradeDate,
    quoteTime,
    tradePrice,
    publishedNav,
    publishedNavDate,
    tencentPremiumPct,
    tencentReferenceNav,
    indexMultiplier,
    fxMultiplier,
    estimatedNav,
    premiumPct,
    formula: {
      estimatedNav: "publishedNav * (indexTradeClose / indexNavClose) * (fxTradeRate / fxNavRate)",
      premiumPct: "(tradePrice / estimatedNav - 1) * 100",
    },
    quoteSource: {
      provider: "Tencent Finance qt.gtimg.cn",
      url: `${TENCENT_QT_URL}?q=${fund.marketSymbol}`,
      marketSymbol: fund.marketSymbol,
      rawTimestamp: fields[30] || null,
      fieldIndexes: {
        tradePrice: 3,
        previousClose: 4,
        quoteTimestamp: 30,
        change: 31,
        changePct: 32,
        tencentPremiumPct: 77,
        tencentReferenceNav: 78,
      },
    },
    navSource: {
      provider: "Tencent Finance getPriceZone",
      url: `${TENCENT_FUND_PRICE_ZONE_URL}?symbol=${fund.marketSymbol}`,
      navPath: "info.dwjz",
      navDatePath: "info.jzrq",
    },
    index,
    fx,
  };
}

function buildFundItem(fund, fields, context) {
  const rawFields = Array.isArray(fields) ? fields : [];
  const isLof = fund.code === LOF_SP500_TECH_CODE;
  const lastClose = toFiniteNumber(rawFields[3]);
  const baseClose = toFiniteNumber(rawFields[4]);
  const latestT = parseTencentBeijingTime(rawFields[30]);
  const tradeDate = parseTencentBeijingDateKey(rawFields[30]);
  const change = toFiniteNumber(rawFields[31]);
  const changePct = toFiniteNumber(rawFields[32]);
  const premiumPctFromTencent = toFiniteNumber(rawFields[77]);
  const premiumReferenceNav = toFiniteNumber(rawFields[78]);
  const lofPremium = isLof ? context?.lofPremium : null;
  const lofPremiumError = isLof ? context?.lofPremiumError || null : null;
  const premiumPct = lofPremiumError
    ? null
    : (Number.isFinite(lofPremium?.premiumPct) ? lofPremium.premiumPct : premiumPctFromTencent);

  return {
    symbol: fund.marketSymbol,
    code: fund.code,
    nameCN: cleanName(rawFields[1], fund.fallbackName),
    icon: fund.icon || null,
    latestT,
    tradeDate,
    period: "1D",
    baseLabel: "\u6628\u6536",
    lastClose,
    baseClose,
    change,
    changePct,
    premiumPct,
    premiumRawPct: premiumPctFromTencent,
    premiumReferenceNav: Number.isFinite(lofPremium?.estimatedNav) ? lofPremium.estimatedNav : premiumReferenceNav,
    lofPremium,
    lofPremiumError,
  };
}

function maxLatestTime(items) {
  const values = (items || [])
    .map((item) => item?.latestT)
    .filter((value) => Number.isFinite(value));

  return values.length ? Math.max(...values) : null;
}

export async function buildFundPremiumPayload(env) {
  const configuredFunds = await getFundPremiumFundList(env);
  const funds = configuredFunds.map((fund) => ({
    ...fund,
    icon: FUND_LOGOS[fund.code] || null,
    marketSymbol: toMarketSymbol(fund.code),
  }));

  if (!funds.length) {
    return {
      ok: true,
      title: "基金折溢价",
      indexSource: LOF_INDEX_DATA_SOURCE,
      indexSourceLabel: indexDataSourceLabel(LOF_INDEX_DATA_SOURCE),
      asOfMs: null,
      tradeDate: null,
      warnings: [],
      items: [],
    };
  }

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

  const lofFund = funds.find((fund) => fund.code === LOF_SP500_TECH_CODE);
  const lofFields = lofFund ? variableMap.get(lofFund.marketSymbol) : null;
  let lofPremium = null;
  let lofPremiumError = null;

  if (lofFund) {
    if (!lofFields || lofFields.length <= 77) {
      lofPremiumError = `Tencent fund quote missing or incomplete for ${lofFund.marketSymbol}`;
    } else {
      try {
        lofPremium = await buildLofPremiumContext(lofFund, lofFields);
      } catch (error) {
        lofPremiumError = error?.message || String(error);
      }
    }
  }

  const items = funds.map((fund) => {
    const fields = variableMap.get(fund.marketSymbol);
    if (!fields || fields.length <= 77) {
      if (fund.code === LOF_SP500_TECH_CODE) {
        return buildFundItem(fund, fields, {
          lofPremium: null,
          lofPremiumError,
        });
      }
      throw new Error(`Tencent fund quote missing or incomplete for ${fund.marketSymbol}`);
    }

    return buildFundItem(fund, fields, {
      lofPremium: fund.code === LOF_SP500_TECH_CODE ? lofPremium : null,
      lofPremiumError: fund.code === LOF_SP500_TECH_CODE ? lofPremiumError : null,
    });
  });

  items.sort((a, b) => {
    const premiumDelta =
      (Number.isFinite(b?.premiumPct) ? b.premiumPct : -Infinity) -
      (Number.isFinite(a?.premiumPct) ? a.premiumPct : -Infinity);
    if (Math.abs(premiumDelta) > 1e-9) return premiumDelta;
    return String(a?.code || "").localeCompare(String(b?.code || ""));
  });

  return {
    ok: true,
    title: "\u57fa\u91d1\u6298\u6ea2\u4ef7",
    indexSource: LOF_INDEX_DATA_SOURCE,
    indexSourceLabel: indexDataSourceLabel(LOF_INDEX_DATA_SOURCE),
    asOfMs: maxLatestTime(items),
    tradeDate: latestTradeDate(items),
    warnings: lofFund && lofPremiumError
      ? [{ code: LOF_SP500_TECH_CODE, message: `161128 折溢价计算失败：${lofPremiumError}` }]
      : [],
    items,
  };
}
