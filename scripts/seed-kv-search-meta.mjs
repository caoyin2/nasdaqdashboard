import { SP500_SECTOR_ETFS, STAR_TECH_COMPANIES } from "../config.js";
import { getLatestIndexWeightSymbols } from "../services/indexWeightsService.js";
import { STAR_TECH_LIST_KEY } from "../services/starTechListStore.js";
import { fetchSeekingAlphaRealTimeQuotesBySlugs } from "../services/seekingAlpha.js";
import { INDEX_WEIGHTS_FALLBACK_META } from "../services/indexWeightsFallback.js";

const BASE_URL = process.env.BASE_URL || "https://stock.caoyinchat.top";
const BATCH_SIZE = 2;
const BATCH_DELAY_MS = 5000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function unique(items) {
  return Array.from(new Set(items.filter(Boolean)));
}

function normalizeTopResult(symbol, quote) {
  const fallback = INDEX_WEIGHTS_FALLBACK_META[symbol] || null;
  return {
    symbol,
    tickerId: Number.isFinite(+quote?.ticker_id) ? +quote.ticker_id : (Number.isFinite(+quote?.sa_id) ? +quote.sa_id : null),
    nameEn: fallback?.nameEn || symbol,
    slug: String(quote?.sa_slug || fallback?.slug || symbol).toLowerCase(),
    iconLight: fallback?.iconLight || `https://static.seekingalpha.com/cdn/s3/company_logos/mark_vector_light/${encodeURIComponent(symbol)}.svg`,
    iconDark: fallback?.iconDark || `https://static.seekingalpha.com/cdn/s3/company_logos/mark_vector_dark/${encodeURIComponent(symbol)}.svg`,
    updatedAt: new Date().toISOString(),
    source: "seed-script",
  };
}

async function writeKv(key, value) {
  const res = await fetch(`${BASE_URL}/api/kv`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      key,
      value,
      metadata: {
        kind: "search-meta",
        symbol: value.symbol,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`KV write failed for ${key}: HTTP ${res.status} ${text.slice(0, 200)}`);
  }

  return res.json();
}

async function seedStarTechList() {
  await writeKv(STAR_TECH_LIST_KEY, STAR_TECH_COMPANIES);
  console.log(`Stored ${STAR_TECH_LIST_KEY}`);
}

async function readKv(key) {
  const res = await fetch(`${BASE_URL}/api/kv?key=${encodeURIComponent(key)}`, {
    headers: {
      "Accept": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`KV read failed for ${key}: HTTP ${res.status} ${text.slice(0, 200)}`);
  }

  return res.json();
}

async function main() {
  await seedStarTechList();

  const latestNdxtmcWeights = await getLatestIndexWeightSymbols("NDXTMC");
  const latestSp500Weights = await getLatestIndexWeightSymbols("SP500-45");
  const latestNdxWeights = await getLatestIndexWeightSymbols("NDX");
  const symbols = unique([
    "SPGI",
    "NDAQ",
    ...STAR_TECH_COMPANIES.map((item) => item.symbol),
    ...SP500_SECTOR_ETFS.map((item) => item.symbol),
    ...latestNdxtmcWeights.symbols,
    ...latestSp500Weights.symbols,
    ...latestNdxWeights.symbols,
  ]);

  const missingSymbols = [];
  for (const symbol of symbols) {
    const key = `search:${symbol}`;
    const existing = await readKv(key);
    if (!existing?.found) {
      missingSymbols.push(symbol);
    }
  }

  console.log(`Checked ${symbols.length} symbols against ${BASE_URL}/api/kv`);
  console.log(`Latest NDXTMC basket date: ${latestNdxtmcWeights.basketDate}`);
  console.log(`Latest SP500-45 equity constituents: ${latestSp500Weights.symbols.length}`);
  console.log(`Latest NDX equity constituents: ${latestNdxWeights.symbols.length}`);
  console.log(`Need to seed ${missingSymbols.length} missing symbols`);

  for (let i = 0; i < missingSymbols.length; i += BATCH_SIZE) {
    const batch = missingSymbols.slice(i, i + BATCH_SIZE);
    console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.join(", ")}`);

    const quotes = await fetchSeekingAlphaRealTimeQuotesBySlugs(batch.map((symbol) => symbol.toLowerCase()));
    const quoteMap = new Map((quotes || []).map((quote) => [String(quote?.symbol || quote?.sa_slug || "").trim().toUpperCase(), quote]));

    const results = await Promise.allSettled(batch.map(async (symbol) => {
      const quote = quoteMap.get(symbol);
      if (!quote) {
        throw new Error(`No slug quote for ${symbol}`);
      }

      const value = normalizeTopResult(symbol, quote);
      await writeKv(`search:${symbol}`, value);
      return value;
    }));

    results.forEach((result, index) => {
      const symbol = batch[index];
      if (result.status === "fulfilled") {
        console.log(`Stored search:${symbol}`);
      } else {
        console.error(`Failed search:${symbol}:`, result.reason?.message || result.reason);
      }
    });

    if (i + BATCH_SIZE < symbols.length) {
      console.log(`Sleeping ${BATCH_DELAY_MS}ms before next batch...`);
      await sleep(BATCH_DELAY_MS);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
