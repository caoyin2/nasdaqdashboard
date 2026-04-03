import { INDEX_WEIGHTS_FALLBACK_META } from "./indexWeightsFallback.js";
import { getSearchMetaBatch } from "./searchMetaStore.js";

const SHENZHEN_TZ = "Asia/Shanghai";
const ETF_BASKET_LOOKBACK_DAYS = 45;
const ETF_INDEX_CONFIG = {
  NDXTMC: {
    etfCode: "159509",
    indexCode: "NDXTMC",
    title: "\u7eb3\u65af\u8fbe\u514b\u79d1\u6280\u5e02\u503c\u52a0\u6743\uff08NDXTMC\uff09",
  },
};

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
    if (result?.text) {
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

  return rows;
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
        name: columns[1],
        shares: parseShares(columns[2]),
        purchaseAmount: parseAmount(columns[columns.length - 3]),
        redemptionAmount: parseAmount(columns[columns.length - 2]),
        market: columns[columns.length - 1],
      };
    })
    .filter(Boolean);

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

async function enrichItems(items, env) {
  const metaMap = await getSearchMetaBatch(
    items.map((item) => item.symbol),
    env,
    { allowFetch: true }
  );

  return items
    .map((item) => {
      const fallback = INDEX_WEIGHTS_FALLBACK_META[item.symbol];
      const meta = metaMap.get(item.symbol);

      return {
        symbol: item.symbol,
        nameEn: meta?.nameEn || fallback?.nameEn || item.symbol,
        iconLight: meta?.iconLight || fallback?.iconLight || null,
        slug: meta?.slug || fallback?.slug || item.symbol.toLowerCase(),
        shares: item.shares,
        purchaseAmount: item.purchaseAmount,
        weightPct: item.weightPct,
      };
    })
    .sort((a, b) => b.weightPct - a.weightPct);
}

export async function getLatestIndexWeightSymbols(indexCode = "NDXTMC") {
  const latestBasket = await fetchLatestBasket(indexCode);
  const parsed = parseBasketRows(latestBasket.text);
  return {
    basketDate: latestBasket.ymd,
    symbols: parsed.items.map((item) => item.symbol),
  };
}

export async function buildIndexWeightsPayload(indexCode = "NDXTMC", env) {
  const config = ETF_INDEX_CONFIG[indexCode];
  if (!config) {
    throw new Error(`Unsupported index code: ${indexCode}`);
  }

  const latestBasket = await fetchLatestBasket(indexCode);
  const parsed = parseBasketRows(latestBasket.text);
  const enrichedItems = await enrichItems(parsed.items, env);

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
