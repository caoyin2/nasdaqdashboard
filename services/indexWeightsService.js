import { INDEX_WEIGHTS_FALLBACK_META } from "./indexWeightsFallback.js";
import { buildDefaultIconLight, getSearchMetaBatch } from "./searchMetaStore.js";

const SHENZHEN_TZ = "Asia/Shanghai";
const ETF_BASKET_LOOKBACK_DAYS = 45;
const ISHARES_HOLDINGS_LOOKBACK_DAYS = 14;
const ISHARES_ORIGIN = "https://www.ishares.com";
const ISHARES_NDX_PRODUCT_URL =
  "https://www.ishares.com/uk/individual/en/products/253741/ishares-nasdaq-100-ucits-etf";
const ISHARES_SP50045_PRODUCT_URL =
  "https://www.ishares.com/uk/individual/en/products/280510/ishares-sp-500-information-technology-sector-ucits-etf";
const ISHARES_HOLDINGS_AJAX_PATH = "1506575576011.ajax";

const INDEX_WEIGHT_CONFIG = {
  NDXTMC: {
    source: "szse",
    etfCode: "159509",
    indexCode: "NDXTMC",
    title: "\u7eb3\u65af\u8fbe\u514b\u79d1\u6280\u5e02\u503c\u52a0\u6743",
    showDataDate: true,
    allowLiveSearch: false,
  },
  "SP500-45": {
    source: "ishares",
    indexCode: "SP500-45",
    title: "\u6807\u666e\u4fe1\u606f\u79d1\u6280",
    showDataDate: true,
    allowLiveSearch: false,
    productPageUrl: ISHARES_SP50045_PRODUCT_URL,
    holdingsUrl: `${ISHARES_SP50045_PRODUCT_URL}/${ISHARES_HOLDINGS_AJAX_PATH}`,
  },
  NDX: {
    source: "ishares",
    indexCode: "NDX",
    title: "\u7eb3\u65af\u8fbe\u514b100",
    showDataDate: true,
    allowLiveSearch: false,
    productPageUrl: ISHARES_NDX_PRODUCT_URL,
    holdingsUrl: `${ISHARES_NDX_PRODUCT_URL}/${ISHARES_HOLDINGS_AJAX_PATH}`,
  },
};

const COMMON_INDEX_CODES = ["NDXTMC", "SP500-45", "NDX"];

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

async function fetchIsharesPageHtml(config) {
  const res = await fetch(config.productPageUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Accept": "text/html,application/xhtml+xml",
      "Cache-Control": "no-cache",
      "Pragma": "no-cache",
      "Referer": ISHARES_ORIGIN + "/",
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`iShares ${config.indexCode} page failed: HTTP ${res.status} ${text.slice(0, 120)}`);
  }

  return res.text();
}

function decodeHtmlAttribute(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function extractIsharesHoldingsRequest(html) {
  const blockMatch = String(html || "").match(
    /<div id="allHoldingsTab"[^>]+data-ajaxUri="([^"]+)"[\s\S]*?<select class="date-dropdown">([\s\S]*?)<\/select>/i
  );

  if (!blockMatch) {
    throw new Error("iShares holdings block not found in product page HTML");
  }

  const ajaxUri = decodeHtmlAttribute(blockMatch[1]);
  const optionHtml = blockMatch[2];
  const asOfDates = Array.from(optionHtml.matchAll(/<option value="(\d{8})"/g)).map((match) => match[1]);
  const latestAsOfDate = asOfDates[0] || null;

  return {
    ajaxUri,
    latestAsOfDate,
  };
}

function buildIsharesHoldingsUrl(baseUrl, asOfDate = null) {
  const url = new URL(baseUrl, ISHARES_ORIGIN);
  url.searchParams.set("tab", "all");
  url.searchParams.set("fileType", "json");
  if (asOfDate) {
    url.searchParams.set("asOfDate", asOfDate);
  }
  return url;
}

async function fetchIsharesHoldingsJson(url, config) {
  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Accept": "application/json,text/plain,*/*",
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
  return JSON.parse(text.replace(/^\uFEFF/, ""));
}

async function resolveIsharesHoldingsBaseUrl(config) {
  if (config.holdingsUrl) {
    return config.holdingsUrl;
  }

  const html = await fetchIsharesPageHtml(config);
  const holdingsRequest = extractIsharesHoldingsRequest(html);
  return new URL(holdingsRequest.ajaxUri, ISHARES_ORIGIN).toString();
}

async function fetchIsharesHoldings(config) {
  const holdingsBaseUrl = await resolveIsharesHoldingsBaseUrl(config);

  for (let offset = 0; offset < ISHARES_HOLDINGS_LOOKBACK_DAYS; offset += 1) {
    const asOfDate = fmtDateYmd(getShanghaiDate(-offset));
    const payload = await fetchIsharesHoldingsJson(buildIsharesHoldingsUrl(holdingsBaseUrl, asOfDate), config);
    if (parseIsharesRows(payload).length) {
      return {
        basketDate: asOfDate,
        payload,
      };
    }
  }

  const payload = await fetchIsharesHoldingsJson(buildIsharesHoldingsUrl(holdingsBaseUrl), config);
  return {
    basketDate: null,
    payload,
  };
}

function parseWeightObject(weightLike) {
  if (weightLike && Number.isFinite(+weightLike.raw)) {
    return +weightLike.raw;
  }

  if (weightLike && typeof weightLike.display === "string") {
    const parsed = Number(weightLike.display.replace(/,/g, "").trim());
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function parseIsharesRows(payload) {
  const rows = Array.isArray(payload?.aaData) ? payload.aaData : [];

  return rows
    .filter((row) => Array.isArray(row) && row[3] === "Equity")
    .map((row) => {
      const symbol = String(row[0] || "").trim().toUpperCase();
      const weightPct = parseWeightObject(row[5]);

      if (!symbol || !Number.isFinite(weightPct)) {
        return null;
      }

      return {
        symbol,
        weightPct,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.weightPct - a.weightPct);
}

async function enrichItems(items, env, options = {}) {
  const metaMap = await getSearchMetaBatch(
    items.map((item) => item.symbol),
    env,
    { allowFetch: options.allowFetch !== false }
  );

  return items
    .map((item) => {
      const fallback = INDEX_WEIGHTS_FALLBACK_META[item.symbol];
      const meta = metaMap.get(item.symbol);

      return {
        symbol: item.symbol,
        nameEn: meta?.nameEn || fallback?.nameEn || item.symbol,
        iconLight: meta?.iconLight || fallback?.iconLight || buildDefaultIconLight(item.symbol),
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

async function buildEnrichedIndexWeightsPayload(raw, env) {
  const enrichedItems = await enrichItems(raw.items, env, {
    allowFetch: raw.config.allowLiveSearch,
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
  const indexPayloads = await Promise.all(
    rawIndexes.map((raw) => buildEnrichedIndexWeightsPayload(raw, env))
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

  const metaMap = await getSearchMetaBatch(commonSymbols, env, { allowFetch: false });

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
      iconLight: meta?.iconLight || fallback?.iconLight || buildDefaultIconLight(symbol),
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
    title: "\u4e09\u5927\u79d1\u6280\u7c7b\u6307\u6570\u5171\u540c\u6210\u4efd\u80a1\u6743\u91cd",
    indexCodes: COMMON_INDEX_CODES,
    indexes: indexPayloads,
    itemCount: items.length,
    items,
  };
}
