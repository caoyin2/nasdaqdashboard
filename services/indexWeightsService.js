import { INDEX_WEIGHTS_FALLBACK_META } from "./indexWeightsFallback.js";
import { getSearchMetaBatch } from "./searchMetaStore.js";

const SHENZHEN_TZ = "Asia/Shanghai";
const ETF_BASKET_LOOKBACK_DAYS = 45;
const ISHARES_ORIGIN = "https://www.ishares.com";
const ISHARES_PRODUCT_DATA_API =
  `${ISHARES_ORIGIN}/varnish-api/uk-retail01-product-data/product-data/api/v2/get-product-data`;
const ISHARES_NDX_PRODUCT_URL =
  "https://www.ishares.com/uk/individual/en/products/253741/ishares-nasdaq-100-ucits-etf";
const ISHARES_SP50045_PRODUCT_URL =
  "https://www.ishares.com/uk/individual/en/products/280510/ishares-sp-500-information-technology-sector-ucits-etf";
const ISHARES_SP500_PRODUCT_URL =
  "https://www.ishares.com/us/products/239726/ishares-core-sp-500-etf";
const SSE_QUERY_API = "https://query.sse.com.cn/commonQuery.do";
const SSE_USA50_PRODUCT_URL =
  "https://www.sse.com.cn/disclosure/fund/etflist/detail.shtml?fundid=513850";
const SSE_DOW_PRODUCT_URL =
  "https://www.sse.com.cn/disclosure/fund/etflist/detail.shtml?fundid=513400";
const SSE_BASIC_SQL_ID =
  "COMMON_SSE_CP_JJLB_ETFJJGK_GGSGSHQD_JBXX_C";
const SSE_COMPONENT_SQL_ID =
  "COMMON_SSE_CP_JJLB_ETFJJGK_GGSGSHQD_COMPONENT_C";

const INDEX_WEIGHT_CONFIG = {
  NDXTMC: {
    source: "szse",
    etfCode: "159509",
    indexCode: "NDXTMC",
    title: "\u7eb3\u65af\u8fbe\u514b\u79d1\u6280\u5e02\u503c\u52a0\u6743",
    showDataDate: true,
  },
  USA50: {
    source: "sse",
    etfCode: "513850",
    indexCode: "USA50",
    title: "\u7f8e\u56fd50",
    showDataDate: true,
    productPageUrl: SSE_USA50_PRODUCT_URL,
  },
  DJI: {
    source: "sse",
    etfCode: "513400",
    indexCode: "DJI",
    title: "\u9053\u743c\u65af\u6307\u6570",
    showDataDate: true,
    productPageUrl: SSE_DOW_PRODUCT_URL,
  },
  "SP500-45": {
    source: "ishares",
    indexCode: "SP500-45",
    title: "\u6807\u666e\u4fe1\u606f\u79d1\u6280",
    showDataDate: true,
    productId: "280510",
    productPageUrl: ISHARES_SP50045_PRODUCT_URL,
  },
  SP500: {
    source: "ishares",
    indexCode: "SP500",
    title: "\u6807\u666e500",
    showDataDate: true,
    productId: "239726",
    productPageUrl: ISHARES_SP500_PRODUCT_URL,
    isharesLocale: "en_US",
    isharesTargetSite: "ishares-us",
  },
  NDX: {
    source: "ishares",
    indexCode: "NDX",
    title: "\u7eb3\u65af\u8fbe\u514b100",
    showDataDate: true,
    productId: "253741",
    productPageUrl: ISHARES_NDX_PRODUCT_URL,
  },
};

const COMMON_INDEX_CODES = ["NDXTMC", "SP500-45", "NDX", "SP500", "USA50"];
const INDEX_WEIGHT_META_OPTIONS = Object.freeze({
  allowFetch: true,
  requireKvIcon: true,
  persistUnresolvedIcon: true,
  fetchBatchSize: 100,
  fetchBatchDelayMs: 0,
});

function buildIndexWeightIcon(symbol) {
  const normalizedSymbol = String(symbol || "").trim().toUpperCase();
  if (!normalizedSymbol) return null;
  return `https://static.seekingalpha.com/cdn/s3/company_logos/mark_vector_light/${encodeURIComponent(normalizedSymbol)}.svg`;
}

function fmtDateYmd(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function getShanghaiDate(offsetDays = 0) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SHENZHEN_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = +parts.find((part) => part.type === "year").value;
  const month = +parts.find((part) => part.type === "month").value;
  const day = +parts.find((part) => part.type === "day").value;
  const utcMidnight = new Date(Date.UTC(year, month - 1, day));
  utcMidnight.setUTCDate(utcMidnight.getUTCDate() + offsetDays);
  return utcMidnight;
}

function parseAmount(value) {
  const normalized = String(value || "").replace(/,/g, "").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseShares(value) {
  const normalized = String(value || "").replace(/,/g, "").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function decodeBasketText(buffer) {
  try {
    return new TextDecoder("gbk").decode(buffer);
  } catch {
    try {
      return new TextDecoder("gb18030").decode(buffer);
    } catch {
      return new TextDecoder("utf-8").decode(buffer);
    }
  }
}

async function fetchBasketText(etfCode, ymd) {
  const url = `https://reportdocs.static.szse.cn/files/text/etf/ETF${etfCode}${ymd}.txt`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "cf-worker-proxy",
      "Accept": "text/plain",
      "Cache-Control": "no-cache",
      "Pragma": "no-cache",
    },
  });

  if (!res.ok) {
    return null;
  }

  const buffer = await res.arrayBuffer();
  return {
    ymd,
    url,
    text: decodeBasketText(buffer),
  };
}

async function fetchLatestBasket(config) {
  for (let offset = 0; offset < ETF_BASKET_LOOKBACK_DAYS; offset += 1) {
    const candidate = getShanghaiDate(-offset);
    const ymd = fmtDateYmd(candidate);
    const result = await fetchBasketText(config.etfCode, ymd);
    if (result?.text) {
      return result;
    }
  }

  throw new Error(
    `No ETF basket file found for ${config.indexCode} in the last ${ETF_BASKET_LOOKBACK_DAYS} days`
  );
}

function extractCompositionLines(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.replace(/\u00a0/g, " "));

  let inSection = false;
  let seenHeader = false;
  const rows = [];

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const compact = line.trim();

    if (!inSection) {
      if (compact === "\u7ec4\u5408\u4fe1\u606f\u5185\u5bb9") {
        inSection = true;
      }
      continue;
    }

    if (!seenHeader) {
      if (compact.startsWith("\u8bc1\u5238\u4ee3\u7801")) {
        seenHeader = true;
      }
      continue;
    }

    if (!compact) {
      continue;
    }

    if (/^-{10,}$/.test(compact)) {
      if (rows.length) {
        break;
      }
      continue;
    }

    rows.push(compact);
  }

  if (rows.length) {
    return rows;
  }

  return lines
    .map((line) => line.trimEnd())
    .filter((line) => {
      const columns = line.trim().split(/\s{2,}/).map((part) => part.trim()).filter(Boolean);
      if (columns.length < 6) return false;
      if (!/^(?:\d{6}|[A-Z][A-Z0-9. -]{0,15})$/.test(columns[0])) return false;
      return Number.isFinite(parseShares(columns[2])) && Number.isFinite(parseAmount(columns[columns.length - 3]));
    });
}

function parseBasketRows(text) {
  const rows = extractCompositionLines(text);
  if (!rows.length) {
    throw new Error("Basket TXT missing composition section");
  }

  const parsedRows = rows
    .map((line) => {
      const columns = line.split(/\s{2,}/).map((part) => part.trim()).filter(Boolean);
      if (columns.length < 6) {
        return null;
      }

      return {
        code: columns[0],
        shares: parseShares(columns[2]),
        purchaseAmount: parseAmount(columns[columns.length - 3]),
      };
    })
    .filter(Boolean);

  const cashRow = parsedRows.find((row) => row.code === "159900");
  if (!cashRow || !Number.isFinite(cashRow.purchaseAmount) || cashRow.purchaseAmount <= 0) {
    throw new Error("Basket TXT missing valid subscription cash row");
  }

  const cashAmount = cashRow.purchaseAmount;
  const items = parsedRows
    .filter((row) => row.code !== "159900" && Number.isFinite(row.purchaseAmount))
    .map((row) => ({
      symbol: row.code,
      shares: row.shares,
      purchaseAmount: row.purchaseAmount,
      weightPct: (row.purchaseAmount / cashAmount) * 100,
    }))
    .sort((a, b) => b.weightPct - a.weightPct);

  return {
    cashAmount,
    items,
  };
}

function parseSseQueryPayload(text) {
  const body = String(text || "").replace(/^\uFEFF/, "").trim();
  const callbackMatch = /^[^(]+\(([\s\S]*)\)\s*;?$/.exec(body);

  try {
    return JSON.parse(callbackMatch ? callbackMatch[1] : body);
  } catch {
    throw new Error("SSE ETF basket returned invalid JSON");
  }
}

function parseSseAmount(value) {
  const normalized = String(value ?? "")
    .replace(/,/g, "")
    .replace(/[^\d.+-]/g, "")
    .trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeSseTicker(value) {
  return String(value || "").trim().toUpperCase().replace(/\//g, ".");
}

async function fetchSseQueryJson(config, sqlId) {
  const url = new URL(SSE_QUERY_API);
  const params = {
    isPagination: "false",
    FUNDID2: config.etfCode,
    sqlId,
    jsonCallBack: "jsonCallback",
  };
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Accept": "application/json, text/javascript, */*; q=0.01",
      "Cache-Control": "no-cache",
      "Pragma": "no-cache",
      "Referer": config.productPageUrl || "https://www.sse.com.cn/",
      "Origin": "https://www.sse.com.cn",
    },
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`SSE ${config.indexCode} basket failed: HTTP ${res.status} ${text.slice(0, 120)}`);
  }

  return parseSseQueryPayload(text);
}

function parseSseBasketRows(basicPayload, componentPayload) {
  const basic = Array.isArray(basicPayload?.result) ? basicPayload.result[0] : null;
  const basketDate = String(basic?.TRADING_DAY || "").replace(/\D/g, "");
  if (!/^\d{8}$/.test(basketDate)) {
    throw new Error("SSE ETF basket missing trading date");
  }

  const components = Array.isArray(componentPayload?.result) ? componentPayload.result : [];
  const rows = components
    .map((row) => ({
      symbol: normalizeSseTicker(row?.INSTRUMENT_ID),
      shares: parseShares(row?.QUANTITY),
      purchaseAmount: parseSseAmount(row?.SUBSTITUTION_CASH_AMOUNT),
    }))
    .filter((row) => row.symbol && Number.isFinite(row.purchaseAmount) && row.purchaseAmount > 0);

  if (!rows.length) {
    throw new Error("SSE ETF basket contains no valid components");
  }

  const componentAmount = rows.reduce((total, row) => total + row.purchaseAmount, 0);
  const navPerCreationUnit = parseSseAmount(basic?.NAVPERCU);
  const preCashComponent = parseSseAmount(basic?.PRE_CASH_COMPONENT);
  const expectedComponentAmount =
    Number.isFinite(navPerCreationUnit) && Number.isFinite(preCashComponent)
      ? navPerCreationUnit - preCashComponent
      : null;

  if (
    Number.isFinite(expectedComponentAmount) &&
    expectedComponentAmount > 0 &&
    Math.abs(componentAmount - expectedComponentAmount) > Math.max(100, expectedComponentAmount * 0.01)
  ) {
    throw new Error("SSE ETF basket component amount does not match NAV less cash component");
  }

  return {
    basketDate,
    cashAmount: componentAmount,
    items: rows
      .map((row) => ({
        ...row,
        weightPct: (row.purchaseAmount / componentAmount) * 100,
      }))
      .sort((a, b) => b.weightPct - a.weightPct),
  };
}

async function fetchSseBasket(config) {
  const [basicPayload, componentPayload] = await Promise.all([
    fetchSseQueryJson(config, SSE_BASIC_SQL_ID),
    fetchSseQueryJson(config, SSE_COMPONENT_SQL_ID),
  ]);
  return parseSseBasketRows(basicPayload, componentPayload);
}

function normalizeIsharesDate(value) {
  const normalized = String(value ?? "").trim();
  return /^\d{8}$/.test(normalized) ? normalized : null;
}

function getIsharesHoldingDataPoints(payload) {
  return payload?.componentsByNameMap?.holdings?.containersByNameMap?.all?.dataPointsByNameMap || null;
}

function getIsharesDateCandidates(payload) {
  const dataPoints = getIsharesHoldingDataPoints(payload);
  const asOfDate = normalizeIsharesDate(dataPoints?.asOfDate?.value);
  const dateList = Array.isArray(dataPoints?.dateList?.value)
    ? dataPoints.dateList.value.map(normalizeIsharesDate).filter(Boolean)
    : [];
  return Array.from(new Set([asOfDate].concat(dateList).filter(Boolean)));
}

function parseIsharesNumber(value) {
  if (Number.isFinite(+value)) return +value;
  if (value && Number.isFinite(+value.raw)) return +value.raw;
  if (value && typeof value.display === "string") {
    const parsed = Number(value.display.replace(/,/g, "").trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function parseIsharesRows(payload) {
  const dataPoints = getIsharesHoldingDataPoints(payload);
  const symbols = Array.isArray(dataPoints?.ticker?.value) ? dataPoints.ticker.value : [];
  const assetClasses = Array.isArray(dataPoints?.assetClass?.value) ? dataPoints.assetClass.value : [];
  const weights = Array.isArray(dataPoints?.holdingPercent?.value) ? dataPoints.holdingPercent.value : [];
  const rowCount = Math.min(symbols.length, weights.length);
  const items = [];

  for (let i = 0; i < rowCount; i += 1) {
    const symbol = String(symbols[i] || "").trim().toUpperCase();
    const assetClass = String(assetClasses[i] || "").trim().toLowerCase();
    const weightPct = parseIsharesNumber(weights[i]);

    if (!symbol || assetClass !== "equity" || !Number.isFinite(weightPct)) continue;
    items.push({ symbol, weightPct });
  }

  return items.sort((a, b) => b.weightPct - a.weightPct);
}

function buildIsharesProductDataUrl(config, asOfDate = null) {
  const url = new URL(ISHARES_PRODUCT_DATA_API);
  const params = {
    appSubType: "ISHARES",
    appType: "PRODUCT_PAGE",
    component: "holdings.all",
    locale: config.isharesLocale || "en_GB",
    portfolioId: config.productId,
    targetSite: config.isharesTargetSite || "ishares-uk",
    userType: "individual",
    excludeContent: "true",
    asOfDate: asOfDate || "",
    includeConfig: "true",
  };

  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url;
}

async function fetchIsharesHoldingsJson(config, asOfDate = null) {
  const url = buildIsharesProductDataUrl(config, asOfDate);
  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Accept": "application/json",
      "Cache-Control": "no-cache",
      "Pragma": "no-cache",
      "Referer": config.productPageUrl || `${ISHARES_ORIGIN}/`,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`iShares ${config.indexCode} weights failed: HTTP ${res.status} ${text.slice(0, 120)}`);
  }

  const text = await res.text();
  try {
    return JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch {
    const responseType = /^\s*</.test(text) ? "HTML" : "invalid JSON";
    throw new Error(`iShares ${config.indexCode} product data returned ${responseType}`);
  }
}

async function fetchIsharesHoldings(config) {
  const latestPayload = await fetchIsharesHoldingsJson(config);
  const dates = getIsharesDateCandidates(latestPayload);
  const payloads = [{
    basketDate: normalizeIsharesDate(
      getIsharesHoldingDataPoints(latestPayload)?.asOfDate?.value
    ),
    payload: latestPayload,
  }];

  if (parseIsharesRows(latestPayload).length) return payloads[0];

  for (const asOfDate of dates) {
    if (asOfDate === payloads[0].basketDate) continue;
    const holding = {
      basketDate: asOfDate,
      payload: await fetchIsharesHoldingsJson(config, asOfDate),
    };
    if (parseIsharesRows(holding.payload).length) return holding;
  }

  throw new Error(`iShares ${config.indexCode} product data contains no equity holdings`);
}

async function enrichItems(items, env, options = {}) {
  const metaMap = options.metaMap || await getSearchMetaBatch(
    items.map((item) => item.symbol),
    env,
    INDEX_WEIGHT_META_OPTIONS
  );

  return items
    .map((item) => {
      const fallback = INDEX_WEIGHTS_FALLBACK_META[item.symbol];
      const meta = metaMap.get(item.symbol);

      return {
        symbol: item.symbol,
        nameEn: meta?.nameEn || fallback?.nameEn || item.symbol,
        iconLight: meta?.iconLight || fallback?.iconLight || buildIndexWeightIcon(item.symbol),
        slug: meta?.slug || fallback?.slug || item.symbol.toLowerCase(),
        shares: item.shares ?? null,
        purchaseAmount: item.purchaseAmount ?? null,
        weightPct: item.weightPct,
      };
    })
    .sort((a, b) => b.weightPct - a.weightPct);
}

async function fetchRawIndexWeights(indexCode) {
  const config = INDEX_WEIGHT_CONFIG[indexCode];
  if (!config) {
    throw new Error(`Unsupported index code: ${indexCode}`);
  }

  if (config.source === "szse") {
    const latestBasket = await fetchLatestBasket(config);
    const parsed = parseBasketRows(latestBasket.text);

    return {
      config,
      indexCode: config.indexCode,
      title: config.title,
      etfCode: config.etfCode,
      basketDate: latestBasket.ymd,
      showDataDate: config.showDataDate,
      cashAmount: parsed.cashAmount,
      items: parsed.items,
    };
  }

  if (config.source === "sse") {
    const basket = await fetchSseBasket(config);

    return {
      config,
      indexCode: config.indexCode,
      title: config.title,
      etfCode: config.etfCode,
      basketDate: basket.basketDate,
      showDataDate: config.showDataDate,
      cashAmount: basket.cashAmount,
      items: basket.items,
    };
  }

  const holdings = await fetchIsharesHoldings(config);
  const items = parseIsharesRows(holdings.payload);

  return {
    config,
    indexCode: config.indexCode,
    title: config.title,
    basketDate: holdings.basketDate,
    showDataDate: config.showDataDate,
    cashAmount: null,
    items,
  };
}

export async function getLatestIndexWeightSymbols(indexCode = "NDXTMC") {
  const raw = await fetchRawIndexWeights(indexCode);
  return {
    basketDate: raw.basketDate,
    showDataDate: true,
    symbols: raw.items.map((item) => item.symbol),
  };
}

async function buildEnrichedIndexWeightsPayload(raw, env, metaMap = null) {
  const enrichedItems = await enrichItems(raw.items, env, {
    metaMap,
  });

  return {
    ok: true,
    indexCode: raw.indexCode,
    title: raw.title,
    etfCode: raw.etfCode,
    basketDate: raw.basketDate,
    showDataDate: raw.showDataDate,
    cashAmount: raw.cashAmount,
    items: enrichedItems,
  };
}

export async function buildIndexWeightsPayload(indexCode = "NDXTMC", env) {
  const raw = await fetchRawIndexWeights(indexCode);
  return buildEnrichedIndexWeightsPayload(raw, env);
}

export async function buildCommonIndexWeightsPayload(env) {
  const rawIndexes = await Promise.all(COMMON_INDEX_CODES.map((indexCode) => fetchRawIndexWeights(indexCode)));
  const metaMap = await getSearchMetaBatch(
    Array.from(new Set(rawIndexes.flatMap((raw) => raw.items.map((item) => item.symbol)))),
    env,
    INDEX_WEIGHT_META_OPTIONS
  );
  const indexPayloads = await Promise.all(
    rawIndexes.map((raw) => buildEnrichedIndexWeightsPayload(raw, env, metaMap))
  );
  const itemMaps = new Map(
    rawIndexes.map((raw) => [
      raw.indexCode,
      new Map(raw.items.map((item) => [item.symbol, item])),
    ])
  );

  const firstIndex = rawIndexes[0];
  const commonSymbols = firstIndex.items
    .map((item) => item.symbol)
    .filter((symbol) => rawIndexes.every((raw) => itemMaps.get(raw.indexCode)?.has(symbol)));

  const items = commonSymbols.map((symbol) => {
    const fallback = INDEX_WEIGHTS_FALLBACK_META[symbol];
    const meta = metaMap.get(symbol);
    const weights = {};
    let totalWeightPct = 0;

    for (const raw of rawIndexes) {
      const item = itemMaps.get(raw.indexCode).get(symbol);
      const weightPct = Number.isFinite(+item?.weightPct) ? +item.weightPct : null;
      weights[raw.indexCode] = weightPct;
      totalWeightPct += Number.isFinite(weightPct) ? weightPct : 0;
    }

    return {
      symbol,
      nameEn: meta?.nameEn || fallback?.nameEn || symbol,
      iconLight: meta?.iconLight || fallback?.iconLight || buildIndexWeightIcon(symbol),
      slug: meta?.slug || fallback?.slug || symbol.toLowerCase(),
      weights,
      totalWeightPct,
      averageWeightPct: totalWeightPct / COMMON_INDEX_CODES.length,
    };
  });

  items.sort((a, b) => {
    const totalDelta = b.totalWeightPct - a.totalWeightPct;
    if (Math.abs(totalDelta) > 1e-9) return totalDelta;

    for (const indexCode of COMMON_INDEX_CODES) {
      const weightDelta = (b.weights[indexCode] ?? -Infinity) - (a.weights[indexCode] ?? -Infinity);
      if (Math.abs(weightDelta) > 1e-9) return weightDelta;
    }

    return String(a.symbol).localeCompare(String(b.symbol));
  });

  return {
    ok: true,
    title: "\u6307\u6570\u5171\u540c\u6210\u4efd\u80a1\u6743\u91cd",
    indexCodes: COMMON_INDEX_CODES,
    indexes: indexPayloads,
    itemCount: items.length,
    items,
  };
}
