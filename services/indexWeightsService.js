/**
 * Build the payload for the "科技类指数权重" panel.
 *
 * Current scope:
 * - only supports NDXTMC
 * - derives constituent weights from the latest available ETF basket TXT
 * - enriches each symbol via Seeking Alpha search results
 *
 * Weight formula:
 *   constituent_weight = 申购替代金额 / 申赎现金
 */

import { fetchSeekingAlphaSearch } from "./seekingAlpha.js";

const SHENZHEN_TZ = "Asia/Shanghai";
const ETF_BASKET_LOOKBACK_DAYS = 45;
const ETF_INDEX_CONFIG = {
  NDXTMC: {
    etfCode: "159509",
    indexCode: "NDXTMC",
    title: "纳指科技市值加权（NDXTMC）",
  },
};

const SEARCH_META_CACHE =
  globalThis.__INDEX_WEIGHT_SEARCH_META_CACHE__ ?? (globalThis.__INDEX_WEIGHT_SEARCH_META_CACHE__ = new Map());

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
    return new TextDecoder("gb18030").decode(buffer);
  }
}

async function fetchBasketText(etfCode, ymd) {
  const url = `https://reportdocs.static.szse.cn/files/text/etf/ETF${etfCode}${ymd}.txt`;
  const res = await fetch(url, {
    cf: { cacheTtl: 300, cacheEverything: true },
    headers: {
      "User-Agent": "cf-worker-proxy",
      "Accept": "text/plain",
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

async function fetchLatestBasket(indexCode) {
  const config = ETF_INDEX_CONFIG[indexCode];
  if (!config) {
    throw new Error(`Unsupported index code: ${indexCode}`);
  }

  for (let offset = 0; offset < ETF_BASKET_LOOKBACK_DAYS; offset += 1) {
    const candidate = getShanghaiDate(-offset);
    const ymd = fmtDateYmd(candidate);
    const result = await fetchBasketText(config.etfCode, ymd);
    if (result && result.text) {
      return result;
    }
  }

  throw new Error(`No ETF basket file found for ${indexCode} in the last ${ETF_BASKET_LOOKBACK_DAYS} days`);
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
      if (compact === "组合信息内容") {
        inSection = true;
      }
      continue;
    }

    if (!seenHeader) {
      if (compact.startsWith("证券代码")) {
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

  return rows;
}

function parseBasketRows(text) {
  const rows = extractCompositionLines(text);
  if (!rows.length) {
    throw new Error("Basket TXT missing composition section");
  }

  const parsedRows = rows.map((line) => {
    const columns = line.split(/\s{2,}/).map((part) => part.trim()).filter(Boolean);
    if (columns.length < 6) {
      return null;
    }

    return {
      code: columns[0],
      name: columns[1],
      shares: parseShares(columns[2]),
      purchaseAmount: parseAmount(columns[columns.length - 3]),
      redemptionAmount: parseAmount(columns[columns.length - 2]),
      market: columns[columns.length - 1],
    };
  }).filter(Boolean);

  const cashRow = parsedRows.find((row) => row.code === "159900");
  if (!cashRow || !Number.isFinite(cashRow.purchaseAmount) || cashRow.purchaseAmount <= 0) {
    throw new Error("Basket TXT missing valid 申赎现金 row");
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

async function fetchSearchMeta(symbol) {
  if (SEARCH_META_CACHE.has(symbol)) {
    return SEARCH_META_CACHE.get(symbol);
  }

  let meta = {
    symbol,
    nameEn: symbol,
    iconLight: null,
    slug: symbol.toLowerCase(),
  };

  try {
    const payload = await fetchSeekingAlphaSearch(symbol);
    const top = payload?.symbols?.[0];

    if (top) {
      meta = {
        symbol,
        nameEn: String(top.content || symbol).replace(/<[^>]+>/g, ""),
        iconLight: top.image?.light || null,
        slug: top.slug || symbol.toLowerCase(),
      };
    }
  } catch (error) {
    console.error(`Index weights search failed for ${symbol}:`, error);
  }

  SEARCH_META_CACHE.set(symbol, meta);
  return meta;
}

async function enrichItems(items) {
  const results = [];
  const batchSize = 6;

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const settled = await Promise.allSettled(
      batch.map(async (item) => {
        const meta = await fetchSearchMeta(item.symbol);
        return {
          symbol: item.symbol,
          nameEn: meta.nameEn,
          iconLight: meta.iconLight,
          slug: meta.slug,
          shares: item.shares,
          purchaseAmount: item.purchaseAmount,
          weightPct: item.weightPct,
        };
      })
    );

    for (const result of settled) {
      if (result.status === "fulfilled") {
        results.push(result.value);
      }
    }
  }

  return results.sort((a, b) => b.weightPct - a.weightPct);
}

export async function buildIndexWeightsPayload(indexCode = "NDXTMC") {
  const config = ETF_INDEX_CONFIG[indexCode];
  if (!config) {
    throw new Error(`Unsupported index code: ${indexCode}`);
  }

  const latestBasket = await fetchLatestBasket(indexCode);
  const parsed = parseBasketRows(latestBasket.text);
  const enrichedItems = await enrichItems(parsed.items);

  return {
    ok: true,
    indexCode: config.indexCode,
    title: config.title,
    etfCode: config.etfCode,
    basketDate: latestBasket.ymd,
    cashAmount: parsed.cashAmount,
    items: enrichedItems,
  };
}
