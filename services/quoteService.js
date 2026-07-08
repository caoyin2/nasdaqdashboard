/**
 * /api/quote 的核心聚合逻辑
 *
 * 当前这个服务只负责指数图表数据。
 * CNN 恐惧贪婪指数已经拆到独立接口 `/api/fear-greed`，
 * 避免它跟随 1D 轮询一起重复刷新。
 */

import { INDEXES, LINE_COLORS } from "../config.js";
import {
  fmtUTC,
  getLastBar,
  patchBarsWithLatest1D,
  parseBarsFromAttributes,
  pickFirstCloseFromBars,
  pickPrevCloseSmart,
} from "../lib/time.js";
import { fetchGoogleFinanceIndexPeriod } from "./googleFinance.js";
import { fetchSeekingAlphaPeriod } from "./seekingAlpha.js";
import { getSearchMetaBatch } from "./searchMetaStore.js";

const GOOGLE_FINANCE_INDEX_SYMBOL = "SP500-45";

function maxLatestTime(items) {
  const values = (items || [])
    .map((item) => item?.latestT)
    .filter((value) => Number.isFinite(value));

  return values.length ? Math.max(...values) : null;
}

function buildQuoteLastBar(quote, fallbackBar) {
  const close = quote?.lastClose;
  const t = Number.isFinite(quote?.latestT) ? quote.latestT : fallbackBar?.t;

  if (!Number.isFinite(close) || !Number.isFinite(t)) {
    return fallbackBar || null;
  }

  const base = Number.isFinite(fallbackBar?.close) ? fallbackBar.close : close;
  return {
    t,
    open: Number.isFinite(fallbackBar?.open) ? fallbackBar.open : base,
    high: Math.max(Number.isFinite(fallbackBar?.high) ? fallbackBar.high : base, close),
    low: Math.min(Number.isFinite(fallbackBar?.low) ? fallbackBar.low : base, close),
    close,
    label: "GOOGLE_QUOTE_LAST",
  };
}

async function buildGoogleFinanceIndexItem(idx, i, period, searchMetaMap) {
  const oneDayPromise = fetchGoogleFinanceIndexPeriod("1D", idx);
  const periodPromise = period === "1D"
    ? oneDayPromise
    : fetchGoogleFinanceIndexPeriod(period, idx);

  const [oneDayRaw, periodRaw] = await Promise.all([
    oneDayPromise,
    periodPromise,
  ]);

  const bars1D = oneDayRaw.bars || [];
  const last1DBar = getLastBar(bars1D);
  const quote = oneDayRaw.quote || periodRaw.quote || {};
  const quoteLastBar = buildQuoteLastBar(quote, last1DBar);

  const latestClose = Number.isFinite(quote?.lastClose) ? quote.lastClose : quoteLastBar?.close;
  const latestT = Number.isFinite(quote?.latestT) ? quote.latestT : quoteLastBar?.t;

  const periodBarsRaw = periodRaw.bars || [];

  const lastClose = Number.isFinite(latestClose)
    ? latestClose
    : getLastBar(periodBarsRaw)?.close ?? null;

  let baseClose = null;

  if (period === "1D") {
    baseClose = Number.isFinite(quote?.prevClose) ? quote.prevClose : oneDayRaw.prevClose;
    if (!Number.isFinite(baseClose)) baseClose = null;
  } else {
    baseClose = pickFirstCloseFromBars(periodBarsRaw);
    if (!Number.isFinite(baseClose)) baseClose = null;
  }

  const barsForSeries = period === "1D"
    ? patchBarsWithLatest1D(bars1D || [], quoteLastBar)
    : patchBarsWithLatest1D(periodBarsRaw || [], quoteLastBar);

  return buildIndexItem(idx, i, searchMetaMap, {
    latestT,
    lastClose,
    baseClose,
    barsForSeries,
  });
}

async function buildSeekingAlphaIndexItem(idx, i, period, searchMetaMap) {
  const needYTDFor1D = period === "1D";

  const oneDayPromise = fetchSeekingAlphaPeriod("1D", idx.tickerId);
  const periodPromise = period === "1D"
    ? oneDayPromise
    : fetchSeekingAlphaPeriod(period, idx.tickerId);

  const [oneDayRaw, periodRaw, ytdRaw] = await Promise.all([
    oneDayPromise,
    periodPromise,
    needYTDFor1D ? fetchSeekingAlphaPeriod("YTD", idx.tickerId) : Promise.resolve(null),
  ]);

  const bars1D = parseBarsFromAttributes(oneDayRaw.attributes);
  const last1DBar = getLastBar(bars1D);

  const latestClose = last1DBar?.close;
  const latestT = last1DBar?.t;

  const periodBarsRaw = parseBarsFromAttributes(periodRaw.attributes);

  const lastClose = Number.isFinite(latestClose)
    ? latestClose
    : getLastBar(periodBarsRaw)?.close ?? null;

  let baseClose = null;

  if (period === "1D") {
    const dailyBars = parseBarsFromAttributes(ytdRaw?.attributes);
    baseClose = pickPrevCloseSmart(dailyBars, bars1D);
    if (!Number.isFinite(baseClose)) baseClose = null;
  } else {
    baseClose = pickFirstCloseFromBars(periodBarsRaw);
    if (!Number.isFinite(baseClose)) baseClose = null;
  }

  const barsForSeries = period === "1D"
    ? (bars1D || [])
    : patchBarsWithLatest1D(periodBarsRaw || [], last1DBar);

  return buildIndexItem(idx, i, searchMetaMap, {
    latestT,
    lastClose,
    baseClose,
    barsForSeries,
  });
}

function buildIndexItem(idx, i, searchMetaMap, data) {
  const baseClose = data.baseClose;
  const lastClose = data.lastClose;
  const barsForSeries = data.barsForSeries || [];

  const line = Number.isFinite(baseClose) && baseClose !== 0
    ? barsForSeries.map((bar) => ({
        t: bar.t,
        close: bar.close,
        pct: (bar.close / baseClose - 1) * 100,
      }))
    : barsForSeries.map((bar) => ({
        t: bar.t,
        close: bar.close,
        pct: null,
      }));

  const cardChg = Number.isFinite(baseClose) && Number.isFinite(lastClose)
    ? lastClose - baseClose
    : null;

  const cardChgPct = Number.isFinite(baseClose) && baseClose !== 0 && Number.isFinite(cardChg)
    ? (cardChg / baseClose) * 100
    : null;

  return {
    tickerId: idx.tickerId,
    symbol: idx.symbol,
    googleSymbol: idx.googleSymbol || idx.symbol,
    googleExchange: idx.googleExchange || null,
    nameCN: idx.nameCN,
    color: LINE_COLORS[i % LINE_COLORS.length],
    iconSymbol: idx.iconSymbol || null,
    iconLight: idx.iconSymbol
      ? (searchMetaMap.get(String(idx.iconSymbol).toUpperCase())?.iconLight || null)
      : null,
    latestT: Number.isFinite(data.latestT) ? data.latestT : null,
    lastClose: Number.isFinite(lastClose) ? lastClose : null,
    cardBaseClose: Number.isFinite(baseClose) ? baseClose : null,
    cardChg: Number.isFinite(cardChg) ? cardChg : null,
    cardChgPct: Number.isFinite(cardChgPct) ? cardChgPct : null,
    line,
  };
}

export async function buildQuotePayload(period, env) {
  const iconSymbols = Array.from(
    new Set(
      INDEXES
        .map((idx) => String(idx.iconSymbol || "").trim().toUpperCase())
        .filter(Boolean)
    )
  );

  const searchMetaMap = await getSearchMetaBatch(iconSymbols, env, {
    allowFetch: true,
  });

  const indexJobs = INDEXES.map(async (idx, i) => {
    return idx.symbol === GOOGLE_FINANCE_INDEX_SYMBOL
      ? buildGoogleFinanceIndexItem(idx, i, period, searchMetaMap)
      : buildSeekingAlphaIndexItem(idx, i, period, searchMetaMap);
  });

  let items;
  try {
    items = await Promise.all(indexJobs);
  } catch (error) {
    throw new Error(`Index upstream request failed: ${error?.message || String(error)}`);
  }

  if (items.length !== INDEXES.length) {
    throw new Error(`Index upstream request incomplete: expected ${INDEXES.length}, got ${items.length}`);
  }

  const asOfMs = maxLatestTime(items);
  const asOfUTC = Number.isFinite(asOfMs) ? fmtUTC(asOfMs) : null;

  return {
    ok: true,
    period,
    asOfMs: Number.isFinite(asOfMs) ? asOfMs : null,
    asOfUTC,
    items,
  };
}
