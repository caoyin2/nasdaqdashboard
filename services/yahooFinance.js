import { getLastBar } from "../lib/time.js";

const YAHOO_CHART_ENDPOINT = "https://query1.finance.yahoo.com/v8/finance/chart";
const YAHOO_TAIWAN_SOURCE = "Yahoo Finance Taiwan";

const PERIOD_OPTIONS = {
  "1D": { range: "1d", interval: "2m" },
  "5D": { range: "5d", interval: "15m" },
  "1M": { range: "1mo", interval: "30m" },
  "6M": { range: "6mo", interval: "1d" },
  YTD: { range: "ytd", interval: "1d" },
  "1Y": { range: "1y", interval: "1d" },
  "5Y": { range: "5y", interval: "1wk" },
  MAX: { range: "max", interval: "1mo" },
};

function normalizePeriod(period) {
  const value = String(period || "1D").trim().toUpperCase();
  return PERIOD_OPTIONS[value] ? value : "1D";
}

function yahooSymbolFor(index) {
  const value = String(index?.yahooSymbol || index?.symbol || "").trim();
  if (!value) throw new Error("Yahoo Finance symbol missing");
  return value.startsWith("^") ? value : `^${value}`;
}

function toFinite(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function unixSecondsToMs(value) {
  const seconds = toFinite(value);
  return Number.isFinite(seconds) ? Math.round(seconds * 1000) : null;
}

function parseBars(result) {
  const timestamps = Array.isArray(result?.timestamp) ? result.timestamp : [];
  const quote = Array.isArray(result?.indicators?.quote) ? result.indicators.quote[0] : null;
  if (!quote) return [];

  const bars = [];
  for (let index = 0; index < timestamps.length; index += 1) {
    const t = unixSecondsToMs(timestamps[index]);
    const close = toFinite(quote?.close?.[index]);
    if (!Number.isFinite(t) || !Number.isFinite(close)) continue;

    const open = toFinite(quote?.open?.[index]);
    const high = toFinite(quote?.high?.[index]);
    const low = toFinite(quote?.low?.[index]);
    bars.push({
      t,
      open: Number.isFinite(open) ? open : close,
      high: Number.isFinite(high) ? high : close,
      low: Number.isFinite(low) ? low : close,
      close,
      label: "YAHOO_CHART",
    });
  }

  return bars;
}

function parseQuote(meta, fallbackBar) {
  const lastClose = fallbackBar?.close ?? toFinite(meta?.regularMarketPrice) ?? null;
  const prevClose =
    toFinite(meta?.chartPreviousClose) ??
    toFinite(meta?.previousClose) ??
    toFinite(meta?.regularMarketPreviousClose) ??
    null;
  const latestT = unixSecondsToMs(meta?.regularMarketTime) ?? fallbackBar?.t ?? null;

  return { lastClose, prevClose, latestT };
}

export async function fetchYahooFinanceIndexPeriod(period, index) {
  const normalizedPeriod = normalizePeriod(period);
  const options = PERIOD_OPTIONS[normalizedPeriod];
  const symbol = yahooSymbolFor(index);
  const url = new URL(`${YAHOO_CHART_ENDPOINT}/${encodeURIComponent(symbol)}`);
  url.searchParams.set("region", "TW");
  url.searchParams.set("lang", "zh-Hant-TW");
  url.searchParams.set("includePrePost", "false");
  url.searchParams.set("interval", options.interval);
  url.searchParams.set("range", options.range);
  url.searchParams.set("corsDomain", "tw.stock.yahoo.com");

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json, text/plain, */*",
      Referer: "https://tw.stock.yahoo.com/",
      "User-Agent": "Mozilla/5.0 NasdaqDashboard/1.0",
    },
    cf: {
      cacheTtl: 0,
      cacheEverything: false,
    },
  });

  if (!response.ok) {
    throw new Error(`Yahoo Finance chart request failed: HTTP ${response.status}`);
  }

  const json = await response.json();
  const chart = json?.chart;
  if (chart?.error) {
    throw new Error(`Yahoo Finance chart error: ${chart.error.description || chart.error.code || "unknown"}`);
  }

  const result = Array.isArray(chart?.result) ? chart.result[0] : null;
  if (!result) {
    throw new Error("Yahoo Finance chart response missing result");
  }

  const bars = parseBars(result);
  const quote = parseQuote(result.meta, getLastBar(bars));
  if (!bars.length && !Number.isFinite(quote.lastClose)) {
    throw new Error(`Yahoo Finance chart response has no price data for ${symbol}`);
  }

  return {
    source: YAHOO_TAIWAN_SOURCE,
    yahooSymbol: symbol,
    period: normalizedPeriod,
    range: options.range,
    interval: options.interval,
    requestUrl: url.toString(),
    bars,
    quote,
    prevClose: quote.prevClose,
  };
}
