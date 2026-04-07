/**
 * Build the payload for the S&P 500 sector ETF panel.
 *
 * Rules stay aligned with the existing index/star panels:
 * - latest always comes from the latest 1D close
 * - 1D base uses smart previous close from YTD daily bars
 * - non-1D base uses the first bar returned by the selected period
 *
 * Search metadata still goes through KV/searchMetaStore so the panel can
 * reuse cached ticker IDs and icons without hardcoding them in runtime logic.
 */

import { SP500_SECTOR_ETFS } from "../config.js";
import {
  getLastBar,
  parseBarsFromAttributes,
  pickFirstCloseFromBars,
  pickPrevCloseSmart,
} from "../lib/time.js";
import { fetchSeekingAlphaPeriod } from "./seekingAlpha.js";
import { getSearchMetaBatch, refreshSearchMeta } from "./searchMetaStore.js";

function buildSectorCard(period, etf, meta, bars1D, periodBarsRaw, ytdBars) {
  const last1DBar = getLastBar(bars1D);
  const latestClose = last1DBar?.close;
  const latestT = last1DBar?.t;

  const lastClose = Number.isFinite(latestClose)
    ? latestClose
    : getLastBar(periodBarsRaw)?.close ?? null;

  let baseClose = null;
  const baseLabel = period === "1D" ? "\u6628\u6536" : "\u8d77\u70b9";

  if (period === "1D") {
    baseClose = pickPrevCloseSmart(ytdBars, bars1D);
  } else {
    baseClose = pickFirstCloseFromBars(periodBarsRaw);
  }

  if (!Number.isFinite(baseClose)) {
    baseClose = null;
  }

  const change = Number.isFinite(lastClose) && Number.isFinite(baseClose)
    ? lastClose - baseClose
    : null;

  const changePct = Number.isFinite(change) && Number.isFinite(baseClose) && baseClose !== 0
    ? (change / baseClose) * 100
    : null;

  return {
    tickerId: meta.tickerId,
    symbol: etf.symbol,
    nameCN: etf.nameCN,
    icon: meta.iconLight || null,
    latestT: Number.isFinite(latestT) ? latestT : null,
    period,
    baseLabel,
    lastClose: Number.isFinite(lastClose) ? lastClose : null,
    baseClose,
    change: Number.isFinite(change) ? change : null,
    changePct: Number.isFinite(changePct) ? changePct : null,
  };
}

export async function buildSp500SectorPayload(period, env) {
  const metaMap = await getSearchMetaBatch(
    SP500_SECTOR_ETFS.map((etf) => etf.symbol),
    env,
    { allowFetch: true }
  );

  async function buildCardWithMeta(etf, meta) {
    if (!meta?.tickerId) {
      throw new Error(`Missing tickerId for ${etf.symbol}`);
    }

    const needYTDFor1D = period === "1D";
    const oneDayPromise = fetchSeekingAlphaPeriod("1D", meta.tickerId);
    const periodPromise = period === "1D"
      ? oneDayPromise
      : fetchSeekingAlphaPeriod(period, meta.tickerId);

    const [oneDayRaw, periodRaw, ytdRaw] = await Promise.all([
      oneDayPromise,
      periodPromise,
      needYTDFor1D ? fetchSeekingAlphaPeriod("YTD", meta.tickerId) : Promise.resolve(null),
    ]);

    const bars1D = parseBarsFromAttributes(oneDayRaw?.attributes);
    const periodBarsRaw = parseBarsFromAttributes(periodRaw?.attributes);
    const ytdBars = ytdRaw ? parseBarsFromAttributes(ytdRaw?.attributes) : null;

    if (!bars1D.length && !periodBarsRaw.length) {
      throw new Error(`No bars for ${etf.symbol} ${period}`);
    }

    return buildSectorCard(period, etf, meta, bars1D, periodBarsRaw, ytdBars);
  }

  const items = [];

  for (const etf of SP500_SECTOR_ETFS) {
    let meta = metaMap.get(etf.symbol);

    try {
      items.push(await buildCardWithMeta(etf, meta));
      continue;
    } catch (error) {
      try {
        const refreshed = await refreshSearchMeta(etf.symbol, env);
        if (refreshed?.tickerId && refreshed.tickerId !== meta?.tickerId) {
          meta = refreshed;
          items.push(await buildCardWithMeta(etf, meta));
          continue;
        }
      } catch (refreshError) {
        console.error("Sector ETF search refresh failed:", refreshError);
      }

      throw new Error(`Sector ETF upstream request failed for ${etf.symbol}: ${error?.message || String(error)}`);
    }
  }

  if (items.length !== SP500_SECTOR_ETFS.length) {
    throw new Error(`Sector ETF upstream request incomplete: expected ${SP500_SECTOR_ETFS.length}, got ${items.length}`);
  }

  items.sort((a, b) => {
    const pctDelta = (Number.isFinite(b?.changePct) ? b.changePct : -Infinity) - (Number.isFinite(a?.changePct) ? a.changePct : -Infinity);
    if (Math.abs(pctDelta) > 1e-9) return pctDelta;

    const changeDelta = (Number.isFinite(b?.change) ? b.change : -Infinity) - (Number.isFinite(a?.change) ? a.change : -Infinity);
    if (Math.abs(changeDelta) > 1e-9) return changeDelta;

    return String(a?.symbol || "").localeCompare(String(b?.symbol || ""));
  });

  let latestMs = -Infinity;
  const latestTimes = [];
  for (const item of items) {
    if (Number.isFinite(item.latestT) && item.latestT > latestMs) {
      latestMs = item.latestT;
    }
    latestTimes.push(item.latestT);
  }

  if (latestTimes.some((value) => !Number.isFinite(value))) {
    throw new Error("Sector ETF upstream request incomplete: missing latest timestamp");
  }

  const referenceLatest = latestTimes[0];
  const mismatchedItems = items.filter((item) => item.latestT !== referenceLatest);
  if (mismatchedItems.length > 0) {
    const mismatchText = items
      .map((item) => `${item.symbol}:${item.latestT}`)
      .join(", ");
    throw new Error(`Sector ETF data timestamp mismatch: ${mismatchText}`);
  }

  return {
    ok: true,
    period,
    asOfMs: Number.isFinite(latestMs) ? latestMs : null,
    title: "\u6807\u666e500\u5404\u677f\u5757ETF",
    items,
  };
}
