/**
 * /api/quote 的核心聚合逻辑
 *
 * 当前这个服务只负责指数图表数据。
 * CNN 恐惧贪婪指数已经拆到独立接口 `/api/fear-greed`，
 * 避免它跟随 1D 轮询一起重复刷新。
 */

import { INDEXES, LINE_COLORS, normalizeIndexDataSource } from "../config.js";
import {
  fmtUTC,
  getLastBar,
  patchBarsWithLatest1D,
  pickFirstCloseFromBars,
} from "../lib/time.js";
import { fetchIndexPeriodBySource, indexDataSourceLabel } from "./indexDataSource.js";
import { getSearchMetaBatch } from "./searchMetaStore.js";

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
    label: "INDEX_QUOTE_LAST",
  };
}

async function buildIndexItemFromSource(idx, i, period, searchMetaMap, source) {
  const oneDayPromise = fetchIndexPeriodBySource(source, "1D", idx);
  const periodPromise = period === "1D"
    ? oneDayPromise
    : fetchIndexPeriodBySource(source, period, idx);

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

  const barsForSeries = normalizeIndexDataSource(source) === "yahoo"
    ? (period === "1D" ? bars1D : periodBarsRaw)
    : (period === "1D"
      ? patchBarsWithLatest1D(bars1D || [], quoteLastBar)
      : patchBarsWithLatest1D(periodBarsRaw || [], quoteLastBar));

  return buildIndexItem(idx, i, searchMetaMap, source, {
    latestT,
    lastClose,
    baseClose,
    barsForSeries,
  });
}

function buildIndexItem(idx, i, searchMetaMap, source, data) {
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
    yahooSymbol: idx.yahooSymbol || null,
    googleSymbol: idx.googleSymbol || idx.symbol,
    googleExchange: idx.googleExchange || null,
    dataSource: normalizeIndexDataSource(source),
    dataSourceLabel: indexDataSourceLabel(source),
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

export async function buildQuotePayload(period, env, source) {
  const normalizedSource = normalizeIndexDataSource(source);
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

  const indexResults = await Promise.allSettled(
    INDEXES.map((idx, i) =>
      buildIndexItemFromSource(idx, i, period, searchMetaMap, normalizedSource)
    )
  );

  const items = [];
  const failedIndexes = [];

  indexResults.forEach((result, i) => {
    if (result.status === "fulfilled") {
      items.push(result.value);
      return;
    }

    failedIndexes.push({
      symbol: INDEXES[i].symbol,
      error: result.reason?.message || String(result.reason),
    });
  });

  if (!items.length) {
    const details = failedIndexes
      .map((item) => `${item.symbol}: ${item.error}`)
      .join("; ");
    throw new Error(`Index upstream request failed: ${details || "no index data returned"}`);
  }

  const asOfMs = maxLatestTime(items);
  const asOfUTC = Number.isFinite(asOfMs) ? fmtUTC(asOfMs) : null;

  return {
    ok: true,
    source: normalizedSource,
    sourceLabel: indexDataSourceLabel(normalizedSource),
    period,
    asOfMs: Number.isFinite(asOfMs) ? asOfMs : null,
    asOfUTC,
    items,
    failedIndexes,
  };
}
