const GOOGLE_FINANCE_TIMEOUT_MS = 12000;
const GOOGLE_FINANCE_ENDPOINT = "https://www.google.com/finance/beta/_/FinHubUi/data/batchexecute";
const GOOGLE_FINANCE_PAGE_BASE = "https://www.google.com/finance/beta/quote";
const GOOGLE_FINANCE_SOURCE = "Google Finance";
const MAPPING_CACHE_TTL_MS = 30 * 60 * 1000;

const PERIOD_RANGE_CODES = {
  "1D": 1,
  "5D": 2,
  "1M": 3,
  "6M": 4,
  YTD: 5,
  "1Y": 6,
  "5Y": 7,
  "10Y": 8,
  MAX: 8,
};

const MAPPING_CACHE =
  globalThis.__GOOGLE_FINANCE_MAPPING_CACHE__ ?? (globalThis.__GOOGLE_FINANCE_MAPPING_CACHE__ = new Map());

function toFiniteNumber(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const number = +value;
  return Number.isFinite(number) ? number : null;
}

function normalizeSymbol(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizePeriod(value) {
  const period = String(value || "1D").toUpperCase();
  return Object.prototype.hasOwnProperty.call(PERIOD_RANGE_CODES, period) ? period : "1D";
}

function googleSymbolFor(index) {
  return normalizeSymbol(index?.googleSymbol || index?.symbol);
}

function googleExchangeFor(index) {
  return normalizeSymbol(index?.googleExchange || index?.exchange);
}

function sourcePathFor(symbol, exchange) {
  return `/finance/beta/quote/${symbol}:${exchange}`;
}

function pageUrlFor(symbol, exchange) {
  return `${GOOGLE_FINANCE_PAGE_BASE}/${encodeURIComponent(symbol)}:${encodeURIComponent(exchange)}?hl=en`;
}

async function fetchWithTimeout(url, label, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(`${label} timeout`), GOOGLE_FINANCE_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        Accept: "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
        ...(options.headers || {}),
      },
    });
    return response;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`${label} timeout after ${GOOGLE_FINANCE_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function readBalancedArray(source, fromIndex) {
  const start = source.indexOf("[", fromIndex);
  if (start < 0) return null;

  let depth = 0;
  let quote = null;
  let escaped = false;

  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }

    if (ch === "\"" || ch === "'") {
      quote = ch;
      continue;
    }

    if (ch === "[") {
      depth += 1;
    } else if (ch === "]") {
      depth -= 1;
      if (depth === 0) {
        return {
          text: source.slice(start, i + 1),
          end: i + 1,
        };
      }
    }
  }

  return null;
}

function extractDataServiceRequests(html) {
  const match = String(html || "").match(/var AF_dataServiceRequests = (\{[\s\S]*?\}); var AF_initDataChunkQueue/);
  const block = match?.[1] || "";
  const entries = new Map();
  const headerPattern = /'([^']+)'\s*:\s*\{id:'([^']+)',request:/g;
  let header;

  while ((header = headerPattern.exec(block))) {
    const request = readBalancedArray(block, headerPattern.lastIndex);
    if (!request) continue;

    try {
      entries.set(header[1], {
        id: header[2],
        request: JSON.parse(request.text),
      });
    } catch {
      entries.set(header[1], {
        id: header[2],
        request: null,
      });
    }

    headerPattern.lastIndex = request.end;
  }

  return entries;
}

async function fetchQuotePageMapping(symbol, exchange, options = {}) {
  const cacheKey = `${symbol}:${exchange}`;
  const cached = MAPPING_CACHE.get(cacheKey);

  if (!options.forceRefresh && cached && Date.now() - cached.savedAt < MAPPING_CACHE_TTL_MS) {
    return cached.value;
  }

  const pageUrl = pageUrlFor(symbol, exchange);
  const response = await fetchWithTimeout(pageUrl, `Google Finance page ${cacheKey}`, {
    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      Referer: "https://www.google.com/finance/beta/",
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Google Finance page ${cacheKey} failed: HTTP ${response.status} ${text.slice(0, 120)}`);
  }

  const html = await response.text();
  const entries = extractDataServiceRequests(html);
  const entity = [[null, [symbol, exchange]]];
  // Google Finance can renumber its page data services. Resolve the chart by
  // its stable RPC identifier first instead of assuming a particular ds key.
  const chartEntry =
    Array.from(entries.values()).find((entry) => entry?.id === "c2u4wc" && Array.isArray(entry.request)) ||
    entries.get("ds:11") ||
    entries.get("ds:10") ||
    entries.get("ds:12");
  // Google Finance added a different ds:14 payload in July 2026. It has a
  // quote-like request shape, but does not return the quote node this parser
  // consumes. Prefer gCvqoe, the page's standard live quote RPC, then retain
  // the prior fallbacks for older page layouts.
  const quoteEntry =
    Array.from(entries.values()).find((entry) => entry?.id === "gCvqoe" && Array.isArray(entry.request)) ||
    entries.get("ds:14") ||
    entries.get("ds:2") ||
    entries.get("ds:8");
  const value = {
    symbol,
    exchange,
    pageUrl,
    sourcePath: sourcePathFor(symbol, exchange),
    chartRpcId: chartEntry?.id || "c2u4wc",
    quoteRpcId: quoteEntry?.id || "gCvqoe",
    quoteRequest: quoteEntry?.request || [entity],
  };

  MAPPING_CACHE.set(cacheKey, {
    savedAt: Date.now(),
    value,
  });

  return value;
}

function parseBatchExecuteFrames(text) {
  const frames = [];
  const lines = String(text || "").split("\n").map((line) => line.trim()).filter(Boolean);

  for (const line of lines) {
    if (!line.startsWith("[")) continue;

    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }

    for (const frame of parsed || []) {
      if (!Array.isArray(frame) || frame[0] !== "wrb.fr") continue;

      let data = null;
      if (frame[2] != null) {
        try {
          data = JSON.parse(frame[2]);
        } catch {
          data = null;
        }
      }

      frames.push({
        rpcId: frame[1],
        data,
      });
    }
  }

  return frames;
}

async function callGoogleFinanceBatch(mapping, calls) {
  const rpcIds = Array.from(new Set(calls.map((call) => call.rpcId).filter(Boolean)));
  const url = new URL(GOOGLE_FINANCE_ENDPOINT);
  url.searchParams.set("rpcids", rpcIds.join(","));
  url.searchParams.set("source-path", mapping.sourcePath);
  url.searchParams.set("hl", "en");
  url.searchParams.set("_reqid", String(Math.floor(Math.random() * 9000) + 1000));
  url.searchParams.set("rt", "c");

  const body = new URLSearchParams({
    "f.req": JSON.stringify([
      calls.map((call, index) => [call.rpcId, JSON.stringify(call.request), null, String(index + 1)]),
    ]),
  });

  const response = await fetchWithTimeout(url.toString(), `Google Finance RPC ${rpcIds.join(",")}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      Origin: "https://www.google.com",
      Referer: mapping.pageUrl,
    },
    body,
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Google Finance RPC ${rpcIds.join(",")} failed: HTTP ${response.status} ${text.slice(0, 120)}`);
  }

  const frames = parseBatchExecuteFrames(text);
  return calls.map((call) => frames.find((frame) => frame.rpcId === call.rpcId) || null);
}

function sameTuple(tuple, symbol, exchange) {
  return (
    Array.isArray(tuple) &&
    normalizeSymbol(tuple[0]) === symbol &&
    normalizeSymbol(tuple[1]) === exchange
  );
}

function findQuoteNode(value, symbol, exchange) {
  if (!Array.isArray(value)) return null;

  if (sameTuple(value[1], symbol, exchange) && Array.isArray(value[5])) {
    return value;
  }

  for (const item of value) {
    const found = findQuoteNode(item, symbol, exchange);
    if (found) return found;
  }

  return null;
}

function parseQuotePayload(data, symbol, exchange) {
  const node = findQuoteNode(data, symbol, exchange);
  if (!node) {
    throw new Error(`Google Finance quote ${symbol}:${exchange} payload missing`);
  }

  const latestEpochSec = toFiniteNumber(Array.isArray(node[17]) ? node[17][0] : null);
  const summary = Array.isArray(node[5]) ? node[5] : [];

  return {
    symbol,
    exchange,
    googleQuote: `${symbol}:${exchange}`,
    name: typeof node[2] === "string" ? node[2] : null,
    lastClose: toFiniteNumber(summary[0]),
    change: toFiniteNumber(summary[1]),
    changePct: toFiniteNumber(summary[2]),
    prevClose: toFiniteNumber(node[7]),
    latestT: Number.isFinite(latestEpochSec) ? latestEpochSec * 1000 : null,
    marketTz: typeof node[12] === "string" ? node[12] : null,
    source: GOOGLE_FINANCE_SOURCE,
  };
}

function findChartNode(value, symbol, exchange) {
  if (!Array.isArray(value)) return null;

  if (sameTuple(value[0], symbol, exchange) && Array.isArray(value[3])) {
    return value;
  }

  for (const item of value) {
    const found = findChartNode(item, symbol, exchange);
    if (found) return found;
  }

  return null;
}

function isOhlcRow(row) {
  return (
    Array.isArray(row) &&
    row.length >= 5 &&
    [0, 1, 2, 3].every((index) => Number.isFinite(+row[index])) &&
    typeof row[4] === "string"
  );
}

function isCloseRow(row) {
  return (
    Array.isArray(row) &&
    Array.isArray(row[0]) &&
    Array.isArray(row[1]) &&
    Number.isFinite(+row[1][0])
  );
}

function findOhlcRows(value) {
  if (!Array.isArray(value)) return null;

  const rowCount = value.filter(isOhlcRow).length;
  if (rowCount >= 2) return value;

  for (const item of value) {
    const found = findOhlcRows(item);
    if (found) return found;
  }

  return null;
}

function findCloseRows(value) {
  if (!Array.isArray(value)) return null;

  const rows = Array.isArray(value[1]) ? value[1] : null;
  if (rows && rows.filter(isCloseRow).length >= 2) return rows;

  for (const item of value) {
    const found = findCloseRows(item);
    if (found) return found;
  }

  return null;
}

function parseGoogleDateTuple(value) {
  if (!Array.isArray(value)) return NaN;

  const year = toFiniteNumber(value[0]);
  const month = toFiniteNumber(value[1]);
  const day = toFiniteNumber(value[2]);
  const hour = toFiniteNumber(value[3]) ?? 0;
  const minute = toFiniteNumber(value[4]) ?? 0;
  const second = toFiniteNumber(value[5]) ?? 0;
  const offsetSeconds = Array.isArray(value[7]) ? toFiniteNumber(value[7][0]) : null;

  if (![year, month, day, hour, minute, second].every(Number.isFinite)) {
    return NaN;
  }

  const localAsUTC = Date.UTC(year, month - 1, day, hour, minute, second);
  return Number.isFinite(offsetSeconds) ? localAsUTC - offsetSeconds * 1000 : localAsUTC;
}

function filterLastYears(bars, years) {
  if (!bars.length) return bars;

  const latest = bars[bars.length - 1]?.t;
  if (!Number.isFinite(latest)) return bars;

  const cutoff = new Date(latest);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - years);
  const cutoffMs = cutoff.getTime();

  return bars.filter((bar) => bar.t >= cutoffMs);
}

function parseChartPayload(data, symbol, exchange, period) {
  if (Array.isArray(data) && data.length === 0) {
    return {
      symbol,
      exchange,
      googleQuote: `${symbol}:${exchange}`,
      period,
      rangeCode: PERIOD_RANGE_CODES[period],
      bars: [],
      prevClose: null,
      name: null,
      intervalSeconds: null,
      source: GOOGLE_FINANCE_SOURCE,
      unsupportedPeriod: true,
    };
  }

  const node = findChartNode(data, symbol, exchange);
  if (!node) {
    throw new Error(`Google Finance chart ${symbol}:${exchange} payload missing`);
  }

  const ohlcRows = findOhlcRows(node[3]) || [];
  const closeRows = ohlcRows.length ? [] : (findCloseRows(node[3]) || []);
  const bars = ohlcRows.length
    ? ohlcRows.map((row) => {
        const t = Date.parse(row[4]);
        const open = toFiniteNumber(row[0]);
        const close = toFiniteNumber(row[1]);
        const high = toFiniteNumber(row[2]);
        const low = toFiniteNumber(row[3]);

        if (![t, open, high, low, close].every(Number.isFinite)) return null;

        return {
          t,
          open,
          high,
          low,
          close,
          label: row[4],
        };
      })
    : closeRows.map((row) => {
        const t = parseGoogleDateTuple(row[0]);
        const close = toFiniteNumber(row[1][0]);

        if (![t, close].every(Number.isFinite)) return null;

        return {
          t,
          open: close,
          high: close,
          low: close,
          close,
          label: new Date(t).toISOString(),
        };
      })
    .filter(Boolean)
    .sort((a, b) => a.t - b.t);

  if (!bars.length) {
    throw new Error(`Google Finance chart ${symbol}:${exchange} has no bars`);
  }

  return {
    symbol,
    exchange,
    googleQuote: `${symbol}:${exchange}`,
    period,
    rangeCode: PERIOD_RANGE_CODES[period],
    bars: period === "10Y" ? filterLastYears(bars, 10) : bars,
    prevClose: toFiniteNumber(node[6]),
    name: typeof node[7] === "string" ? node[7] : null,
    intervalSeconds: toFiniteNumber(node[8]),
    source: GOOGLE_FINANCE_SOURCE,
  };
}

function buildChartRequest(symbol, exchange, period) {
  const entity = [[null, [symbol, exchange]]];
  const rangeCode = PERIOD_RANGE_CODES[period] || PERIOD_RANGE_CODES["1D"];
  if (period === "1D") {
    return [entity, rangeCode, null, null, null, null, null, 1];
  }
  return [entity, rangeCode];
}

async function fetchIndexPeriodWithMapping(index, period, mapping) {
  const symbol = mapping.symbol;
  const exchange = mapping.exchange;
  const chartRequest = buildChartRequest(symbol, exchange, period);
  const [chartFrame, quoteFrame] = await callGoogleFinanceBatch(mapping, [
    {
      rpcId: mapping.chartRpcId,
      request: chartRequest,
    },
    {
      rpcId: mapping.quoteRpcId,
      request: mapping.quoteRequest,
    },
  ]);

  if (!chartFrame?.data) {
    throw new Error(`Google Finance chart ${symbol}:${exchange} returned no data`);
  }
  if (!quoteFrame?.data) {
    throw new Error(`Google Finance quote ${symbol}:${exchange} returned no data`);
  }

  const chart = parseChartPayload(chartFrame.data, symbol, exchange, period);
  const quote = parseQuotePayload(quoteFrame.data, symbol, exchange);

  return {
    ...chart,
    quote,
    pageUrl: mapping.pageUrl,
    sourcePath: mapping.sourcePath,
    tickerId: index?.tickerId ?? null,
  };
}

export async function fetchGoogleFinanceIndexPeriod(period, index, options = {}) {
  const normalizedPeriod = normalizePeriod(period);
  const symbol = googleSymbolFor(index);
  const exchange = googleExchangeFor(index);

  if (!symbol || !exchange) {
    throw new Error(`Google Finance symbol or exchange missing for ${index?.symbol || "index"}`);
  }

  const mapping = await fetchQuotePageMapping(symbol, exchange, {
    forceRefresh: !!options.forceRefresh,
  });

  try {
    return await fetchIndexPeriodWithMapping(index, normalizedPeriod, mapping);
  } catch (error) {
    if (options.forceRefresh) throw error;
    const refreshed = await fetchQuotePageMapping(symbol, exchange, { forceRefresh: true });
    return fetchIndexPeriodWithMapping(index, normalizedPeriod, refreshed);
  }
}

export async function fetchGoogleFinanceDailyBars(index, period = "YTD") {
  const payload = await fetchGoogleFinanceIndexPeriod(period, index);
  return payload.bars || [];
}

export const GOOGLE_FINANCE_DATA_SOURCE = GOOGLE_FINANCE_SOURCE;
