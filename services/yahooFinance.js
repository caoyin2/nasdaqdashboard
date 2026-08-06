import { getLastBar } from "../lib/time.js";

const YAHOO_CHART_ENDPOINTS = [
  "https://query1.finance.yahoo.com/v8/finance/chart",
  "https://query2.finance.yahoo.com/v8/finance/chart",
];
const YAHOO_TAIWAN_SOURCE = "Yahoo Finance Taiwan";
const YAHOO_1D_STALE_MS = 15 * 60 * 1000;

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
  const lastClose =
    toFinite(meta?.regularMarketPrice) ??
    fallbackBar?.close ??
    null;
  const prevClose =
    toFinite(meta?.chartPreviousClose) ??
    toFinite(meta?.previousClose) ??
    toFinite(meta?.regularMarketPreviousClose) ??
    null;
  const latestT = unixSecondsToMs(meta?.regularMarketTime) ?? fallbackBar?.t ?? null;
  const regularSessionStartT = unixSecondsToMs(meta?.currentTradingPeriod?.regular?.start);

  return { lastClose, prevClose, latestT, regularSessionStartT };
}

function quoteBar(t, close, label) {
  return {
    t,
    open: close,
    high: close,
    low: close,
    close,
    label,
  };
}

function stabilizeOneDayBars(bars, quote) {
  if (bars.length >= 2) return bars;

  const latestClose = quote?.lastClose;
  const latestT = quote?.latestT ?? getLastBar(bars)?.t ?? null;
  if (!Number.isFinite(latestClose) || !Number.isFinite(latestT)) return bars;

  const prevClose = quote?.prevClose;
  if (Number.isFinite(prevClose)) {
    // Yahoo can return a valid 1D quote with only one intraday point. Keep the
    // chart usable by representing the daily move from the regular-session
    // open, rather than inventing an arbitrary clock time.
    const startT = Number.isFinite(quote?.regularSessionStartT) && quote.regularSessionStartT < latestT
      ? quote.regularSessionStartT
      : latestT - 1;
    return [
      quoteBar(startT, prevClose, "YAHOO_PREVIOUS_CLOSE"),
      quoteBar(latestT, latestClose, "YAHOO_QUOTE_LAST"),
    ];
  }

  const output = bars.slice();
  const lastBar = getLastBar(output);
  if (!lastBar || lastBar.t !== latestT) {
    output.push(quoteBar(latestT, latestClose, "YAHOO_QUOTE_LAST"));
  } else {
    output[output.length - 1] = {
      ...lastBar,
      close: latestClose,
      high: Math.max(lastBar.high, latestClose),
      low: Math.min(lastBar.low, latestClose),
    };
  }
  return output;
}

function buildYahooChartUrl(endpoint, symbol, options) {
  const url = new URL(`${endpoint}/${encodeURIComponent(symbol)}`);
  url.searchParams.set("region", "TW");
  url.searchParams.set("lang", "zh-Hant-TW");
  url.searchParams.set("includePrePost", "false");
  url.searchParams.set("interval", options.interval);
  url.searchParams.set("range", options.range);
  url.searchParams.set("corsDomain", "tw.stock.yahoo.com");
  // Yahoo's chart CDN can otherwise reuse an expired intraday response.
  url.searchParams.set("cachebust", String(Date.now()));
  return url;
}

async function fetchYahooChartResult(url) {
  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json, text/plain, */*",
      Referer: "https://tw.stock.yahoo.com/",
      "User-Agent": "Mozilla/5.0 NasdaqDashboard/1.0",
      "Cache-Control": "no-cache, no-store, max-age=0",
      Pragma: "no-cache",
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
  return result;
}

function parseYahooChartResult(result, period, symbol) {
  const parsedBars = parseBars(result);
  const quote = parseQuote(result.meta, getLastBar(parsedBars));
  const bars = period === "1D"
    ? stabilizeOneDayBars(parsedBars, quote)
    : parsedBars;
  if (!bars.length && !Number.isFinite(quote.lastClose)) {
    throw new Error(`Yahoo Finance chart response has no price data for ${symbol}`);
  }
  return { bars, quote };
}

function isStaleOneDayQuote(quote) {
  const latestT = quote?.latestT;
  return !Number.isFinite(latestT) || Date.now() - latestT > YAHOO_1D_STALE_MS;
}

function hasNewerQuote(candidate, current) {
  const candidateT = candidate?.quote?.latestT;
  const currentT = current?.quote?.latestT;
  return Number.isFinite(candidateT) && (!Number.isFinite(currentT) || candidateT > currentT);
}

export async function fetchYahooFinanceIndexPeriod(period, index) {
  const normalizedPeriod = normalizePeriod(period);
  const options = PERIOD_OPTIONS[normalizedPeriod];
  const symbol = yahooSymbolFor(index);
  let requestUrl = buildYahooChartUrl(YAHOO_CHART_ENDPOINTS[0], symbol, options);
  let data = parseYahooChartResult(
    await fetchYahooChartResult(requestUrl),
    normalizedPeriod,
    symbol
  );

  if (normalizedPeriod === "1D" && isStaleOneDayQuote(data.quote)) {
    try {
      const fallbackUrl = buildYahooChartUrl(YAHOO_CHART_ENDPOINTS[1], symbol, options);
      const fallbackData = parseYahooChartResult(
        await fetchYahooChartResult(fallbackUrl),
        normalizedPeriod,
        symbol
      );
      if (hasNewerQuote(fallbackData, data)) {
        requestUrl = fallbackUrl;
        data = fallbackData;
      }
    } catch {
      // Keep the primary response when Yahoo's alternate CDN is unavailable.
    }
  }

  return {
    source: YAHOO_TAIWAN_SOURCE,
    yahooSymbol: symbol,
    period: normalizedPeriod,
    range: options.range,
    interval: options.interval,
    requestUrl: requestUrl.toString(),
    bars: data.bars,
    quote: data.quote,
    prevClose: data.quote.prevClose,
  };
}
