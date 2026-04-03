import { STAR_TECH_COMPANIES } from "../config.js";
import { getLatestIndexWeightSymbols } from "../services/indexWeightsService.js";
import { fetchSeekingAlphaSearch } from "../services/seekingAlpha.js";

const BASE_URL = process.env.BASE_URL || "https://stock.caoyinchat.top";
const BATCH_SIZE = 2;
const BATCH_DELAY_MS = 5000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function unique(items) {
  return Array.from(new Set(items.filter(Boolean)));
}

function normalizeTopResult(symbol, top) {
  return {
    symbol,
    tickerId: Number.isFinite(+top?.id) ? +top.id : null,
    nameEn: String(top?.content || symbol).replace(/<[^>]+>/g, ""),
    slug: String(top?.slug || symbol).toLowerCase(),
    iconLight: top?.image?.light || null,
    iconDark: top?.image?.dark || null,
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
  const latestNdxtmcWeights = await getLatestIndexWeightSymbols("NDXTMC");
  const latestSp500Weights = await getLatestIndexWeightSymbols("SP500-45");
  const latestNdxWeights = await getLatestIndexWeightSymbols("NDX");
  const symbols = unique([
    ...STAR_TECH_COMPANIES.map((item) => item.symbol),
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

    const results = await Promise.allSettled(
      batch.map(async (symbol) => {
        const payload = await fetchSeekingAlphaSearch(symbol);
        const top = payload?.symbols?.[0];
        if (!top) {
          throw new Error(`No search result for ${symbol}`);
        }

        const value = normalizeTopResult(symbol, top);
        await writeKv(`search:${symbol}`, value);
        return value;
      })
    );

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
