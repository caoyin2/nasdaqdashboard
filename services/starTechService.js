/**
 * Build the card payload for the star-tech panel.
 *
 * Rules are intentionally aligned with the main index panel:
 * - latest value always comes from the latest 1D bar
 * - 1D base uses the smart previous close from YTD daily bars
 * - non-1D base uses the first bar returned for the selected period
 *
 * This keeps percentage changes consistent between the star-tech panel and
 * the main index cards.
 */

import { STAR_TECH_COMPANIES } from "../config.js";
import {
  getLastBar,
  parseBarsFromAttributes,
  pickFirstCloseFromBars,
  pickPrevCloseSmart,
} from "../lib/time.js";
import { fetchSeekingAlphaPeriod } from "./seekingAlpha.js";
import { getSearchMetaBatch, refreshSearchMeta } from "./searchMetaStore.js";

function buildStarCard(period, company, meta, bars1D, periodBarsRaw, ytdBars) {
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
    symbol: company.symbol,
    nameCN: company.nameCN,
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

export async function buildStarTechPayload(period, env) {
  const metaMap = await getSearchMetaBatch(
    STAR_TECH_COMPANIES.map((company) => company.symbol),
    env,
    { allowFetch: true }
  );

  async function buildCardWithMeta(company, meta) {
    if (!meta?.tickerId) {
      throw new Error(`Missing tickerId for ${company.symbol}`);
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
      throw new Error(`No bars for ${company.symbol} ${period}`);
    }

    return buildStarCard(period, company, meta, bars1D, periodBarsRaw, ytdBars);
  }

  const jobFactories = STAR_TECH_COMPANIES.map((company) => async () => {
    let meta = metaMap.get(company.symbol);

    try {
      return await buildCardWithMeta(company, meta);
    } catch (error) {
      const refreshed = await refreshSearchMeta(company.symbol, env);
      if (!refreshed?.tickerId || refreshed.tickerId === meta?.tickerId) {
        throw error;
      }
      meta = refreshed;
      return buildCardWithMeta(company, meta);
    }
  });

  const results = [];

  for (const run of jobFactories) {
    results.push(await Promise.resolve(run()).then(
      (value) => ({ status: "fulfilled", value }),
      (reason) => ({ status: "rejected", reason })
    ));
  }

  const items = [];
  const errors = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      items.push(result.value);
    } else {
      console.error("Star tech fetch failed:", result.reason);
      errors.push(result.reason?.message || String(result.reason));
    }
  }

  if (items.length === 0) {
    const sample = errors.slice(0, 3).join(" | ");
    throw new Error(`All star-tech upstream requests failed${sample ? `: ${sample}` : ""}`);
  }

  let latestMs = -Infinity;
  for (const item of items) {
    if (Number.isFinite(item.latestT) && item.latestT > latestMs) {
      latestMs = item.latestT;
    }
  }

  return {
    ok: true,
    period,
    asOfMs: Number.isFinite(latestMs) ? latestMs : null,
    items,
  };
}
