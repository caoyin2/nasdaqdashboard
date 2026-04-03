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

function buildStarCard(period, company, bars1D, periodBarsRaw, ytdBars) {
  const last1DBar = getLastBar(bars1D);
  const latestClose = last1DBar?.close;

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
    tickerId: company.tickerId,
    symbol: company.symbol,
    nameCN: company.nameCN,
    icon: company.icon,
    period,
    baseLabel,
    lastClose: Number.isFinite(lastClose) ? lastClose : null,
    baseClose,
    change: Number.isFinite(change) ? change : null,
    changePct: Number.isFinite(changePct) ? changePct : null,
  };
}

export async function buildStarTechPayload(period) {
  const jobs = STAR_TECH_COMPANIES.map(async (company) => {
    const needYTDFor1D = period === "1D";
    const oneDayPromise = fetchSeekingAlphaPeriod("1D", company.tickerId);
    const periodPromise = period === "1D"
      ? oneDayPromise
      : fetchSeekingAlphaPeriod(period, company.tickerId);

    const [oneDayRaw, periodRaw, ytdRaw] = await Promise.all([
      oneDayPromise,
      periodPromise,
      needYTDFor1D ? fetchSeekingAlphaPeriod("YTD", company.tickerId) : Promise.resolve(null),
    ]);

    const bars1D = parseBarsFromAttributes(oneDayRaw?.attributes);
    const periodBarsRaw = parseBarsFromAttributes(periodRaw?.attributes);
    const ytdBars = ytdRaw ? parseBarsFromAttributes(ytdRaw?.attributes) : null;

    if (!bars1D.length && !periodBarsRaw.length) {
      throw new Error(`No bars for ${company.symbol} ${period}`);
    }

    return buildStarCard(period, company, bars1D, periodBarsRaw, ytdBars);
  });

  const results = [];
  const batchSize = 4;

  for (let i = 0; i < jobs.length; i += batchSize) {
    const settled = await Promise.allSettled(jobs.slice(i, i + batchSize));
    results.push(...settled);
  }

  const items = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      items.push(result.value);
    } else {
      console.error("Star tech fetch failed:", result.reason);
    }
  }

  if (items.length === 0) {
    throw new Error("All star-tech upstream requests failed");
  }

  return {
    ok: true,
    period,
    items,
  };
}
