/**
 * Build the card payload for the star-tech panel.
 *
 * Requirements:
 * - company metadata is hardcoded, no runtime search lookup
 * - periods are loaded on demand from the frontend
 * - 1D can refresh every 30s, non-1D should be cache-friendly
 * - no chart payload, cards only
 */

import { STAR_TECH_COMPANIES } from "../config.js";
import {
  getLastBar,
  parseBarsFromAttributes,
  pickFirstCloseFromBars,
  pickPrevCloseSmart,
} from "../lib/time.js";
import { fetchSeekingAlphaPeriod } from "./seekingAlpha.js";

function buildStarCard(period, company, periodBars, ytdBars) {
  const lastBar = getLastBar(periodBars);
  const lastClose = lastBar?.close;

  let baseClose = null;
  const baseLabel = period === "1D" ? "\u6628\u6536" : "\u8d77\u70b9";

  if (period === "1D") {
    baseClose = pickPrevCloseSmart(ytdBars, periodBars);
  } else {
    baseClose = pickFirstCloseFromBars(periodBars);
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
    const [periodRaw, ytdRaw] = await Promise.all([
      fetchSeekingAlphaPeriod(period, company.tickerId),
      period === "1D" ? fetchSeekingAlphaPeriod("YTD", company.tickerId) : Promise.resolve(null),
    ]);

    const periodBars = parseBarsFromAttributes(periodRaw?.attributes);
    const ytdBars = ytdRaw ? parseBarsFromAttributes(ytdRaw?.attributes) : null;

    if (!periodBars.length) {
      throw new Error(`No bars for ${company.symbol} ${period}`);
    }

    return buildStarCard(period, company, periodBars, ytdBars);
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
