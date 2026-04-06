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
  parseBarsFromAttributes,
  patchBarsWithLatest1D,
  pickFirstCloseFromBars,
  pickPrevCloseSmart,
} from "../lib/time.js";
import { fetchSeekingAlphaPeriod } from "./seekingAlpha.js";
import { getSearchMetaBatch } from "./searchMetaStore.js";

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
      nameCN: idx.nameCN,
      color: LINE_COLORS[i % LINE_COLORS.length],
      iconSymbol: idx.iconSymbol || null,
      iconLight: idx.iconSymbol
        ? (searchMetaMap.get(String(idx.iconSymbol).toUpperCase())?.iconLight || null)
        : null,
      latestT: Number.isFinite(latestT) ? latestT : null,
      lastClose: Number.isFinite(lastClose) ? lastClose : null,
      cardBaseClose: Number.isFinite(baseClose) ? baseClose : null,
      cardChg: Number.isFinite(cardChg) ? cardChg : null,
      cardChgPct: Number.isFinite(cardChgPct) ? cardChgPct : null,
      line,
    };
  });

  const indexResults = await Promise.allSettled(indexJobs);

  const items = indexResults
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value);

  for (const result of indexResults) {
    if (result.status === "rejected") {
      console.error("Index fetch failed:", result.reason);
    }
  }

  if (items.length === 0) {
    throw new Error("All index upstream requests failed");
  }

  let asOfUTC = null;
  let latestMs = -Infinity;

  for (const item of items) {
    if (Number.isFinite(item.latestT) && item.latestT > latestMs) {
      latestMs = item.latestT;
      asOfUTC = fmtUTC(item.latestT);
    }
  }

  return {
    ok: true,
    period,
    asOfMs: Number.isFinite(latestMs) ? latestMs : null,
    asOfUTC,
    items,
  };
}
