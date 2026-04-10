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

import {
  getLastBar,
  patchBarsWithLatest1D,
  parseTimeKeyToUTCms,
  parseBarsFromAttributes,
  pickFirstCloseFromBars,
  pickPrevCloseSmart,
} from "../lib/time.js";
import { fetchSeekingAlphaPeriod, fetchSeekingAlphaRealTimeQuotes } from "./seekingAlpha.js";
import { getSearchMetaBatch, refreshSearchMeta } from "./searchMetaStore.js";
import { getStarTechCompanyList } from "./starTechListStore.js";

function maxLatestTime(items) {
  const values = (items || [])
    .map((item) => item?.latestT)
    .filter((value) => Number.isFinite(value));

  return values.length ? Math.max(...values) : null;
}

function buildSparklineSeries(bars) {
  const values = (bars || [])
    .map((bar) => (Number.isFinite(bar?.close) ? +bar.close : null))
    .filter((value) => Number.isFinite(value));

  return values.length > 1 ? values : null;
}

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

  const sparklineBars = period === "1D"
    ? null
    : patchBarsWithLatest1D(periodBarsRaw || [], last1DBar);

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
    sparkline: buildSparklineSeries(sparklineBars),
  };
}

function buildStarCardFromRealTimeQuote(company, meta, quote) {
  const lastClose = Number.isFinite(+quote?.last) ? +quote.last : Number.isFinite(+quote?.close) ? +quote.close : null;
  const baseClose = Number.isFinite(+quote?.prev_close) ? +quote.prev_close : null;
  const latestT = parseTimeKeyToUTCms(quote?.last_time);
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
    period: "1D",
    baseLabel: "\u6628\u6536",
    lastClose,
    baseClose,
    change: Number.isFinite(change) ? change : null,
    changePct: Number.isFinite(changePct) ? changePct : null,
    sparkline: null,
  };
}

export async function buildStarTechPayload(period, env) {
  const companies = await getStarTechCompanyList(env);

  const metaMap = await getSearchMetaBatch(
    companies.map((company) => company.symbol),
    env,
    { allowFetch: true }
  );

  if (period === "1D") {
    const missingMetaSymbols = companies
      .filter((company) => !metaMap.get(company.symbol)?.tickerId)
      .map((company) => company.symbol);

    if (missingMetaSymbols.length > 0) {
      throw new Error(`Missing tickerId for ${missingMetaSymbols.join(", ")}`);
    }

    const quotes = await fetchSeekingAlphaRealTimeQuotes(
      companies.map((company) => metaMap.get(company.symbol)?.tickerId)
    );
    const quoteMap = new Map(
      quotes
        .filter((quote) => Number.isFinite(+quote?.ticker_id))
        .map((quote) => [+quote.ticker_id, quote])
    );

    const items = companies.map((company) => {
      const meta = metaMap.get(company.symbol);
      const quote = quoteMap.get(meta.tickerId);

      if (!quote) {
        throw new Error(`Missing real-time quote for ${company.symbol}`);
      }

      return buildStarCardFromRealTimeQuote(company, meta, quote);
    });

    if (items.length !== companies.length) {
      throw new Error(`Star-tech upstream request incomplete: expected ${companies.length}, got ${items.length}`);
    }

    return {
      ok: true,
      period,
      asOfMs: maxLatestTime(items),
      items,
    };
  }

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

  const jobFactories = companies.map((company) => async () => {
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

  let items;
  try {
    items = [];
    for (const run of jobFactories) {
      items.push(await run());
    }
  } catch (error) {
    throw new Error(`Star-tech upstream request failed: ${error?.message || String(error)}`);
  }

  if (items.length !== companies.length) {
    throw new Error(`Star-tech upstream request incomplete: expected ${companies.length}, got ${items.length}`);
  }

  return {
    ok: true,
    period,
    asOfMs: maxLatestTime(items),
    items,
  };
}
