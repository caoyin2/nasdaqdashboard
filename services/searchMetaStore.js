/**
 * Search metadata cache layer.
 *
 * Data source priority:
 * 1. in-memory cache inside the isolate
 * 2. Worker KV (`NasdaqDashboard`)
 * 3. live Seeking Alpha search API
 *
 * When live fetching is needed, requests are rate-limited:
 * - maximum 2 concurrent requests per batch
 * - 5 seconds pause between batches
 */

import { fetchSeekingAlphaSearch } from "./seekingAlpha.js";
import { INDEX_WEIGHTS_FALLBACK_META } from "./indexWeightsFallback.js";

const SEARCH_META_PREFIX = "search:";
const SEARCH_META_BATCH_SIZE = 2;
const SEARCH_META_BATCH_DELAY_MS = 5000;
const SEARCH_META_MEM_CACHE =
  globalThis.__SEARCH_META_MEM_CACHE__ ?? (globalThis.__SEARCH_META_MEM_CACHE__ = new Map());

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeSymbol(symbol) {
  return String(symbol || "").trim().toUpperCase();
}

export function getSearchMetaKey(symbol) {
  return `${SEARCH_META_PREFIX}${normalizeSymbol(symbol)}`;
}

function sanitizeTopSearchResult(symbol, top) {
  if (!top) return null;

  return {
    symbol,
    tickerId: Number.isFinite(+top.id) ? +top.id : null,
    nameEn: String(top.content || symbol).replace(/<[^>]+>/g, ""),
    slug: String(top.slug || symbol).toLowerCase(),
    iconLight: top.image?.light || null,
    iconDark: top.image?.dark || null,
    updatedAt: new Date().toISOString(),
  };
}

function buildFallbackMeta(symbol) {
  const fallback = INDEX_WEIGHTS_FALLBACK_META[symbol];
  if (!fallback) return null;

  return {
    symbol,
    tickerId: null,
    nameEn: fallback.nameEn || symbol,
    slug: fallback.slug || symbol.toLowerCase(),
    iconLight: fallback.iconLight || null,
    iconDark: fallback.iconDark || null,
    updatedAt: new Date().toISOString(),
    source: "fallback",
  };
}

export async function readSearchMetaFromKv(env, symbol) {
  const key = getSearchMetaKey(symbol);
  const kv = env?.NasdaqDashboard;
  if (!kv || typeof kv.get !== "function") {
    return null;
  }

  try {
    const value = await kv.get(key, "json");
    if (value && typeof value === "object") {
      const normalized = {
        symbol: normalizeSymbol(value.symbol || symbol),
        tickerId: Number.isFinite(+value.tickerId) ? +value.tickerId : null,
        nameEn: value.nameEn || normalizeSymbol(symbol),
        slug: value.slug || normalizeSymbol(symbol).toLowerCase(),
        iconLight: value.iconLight || null,
        iconDark: value.iconDark || null,
        updatedAt: value.updatedAt || null,
        source: value.source || "kv",
      };
      SEARCH_META_MEM_CACHE.set(normalized.symbol, normalized);
      return normalized;
    }
  } catch (error) {
    console.error(`KV read failed for search meta ${key}:`, error);
  }

  return null;
}

export async function writeSearchMetaToKv(env, meta) {
  const kv = env?.NasdaqDashboard;
  if (!kv || typeof kv.put !== "function" || !meta?.symbol) {
    return false;
  }

  const key = getSearchMetaKey(meta.symbol);

  try {
    await kv.put(key, JSON.stringify(meta), {
      metadata: {
        kind: "search-meta",
        symbol: meta.symbol,
      },
    });
    SEARCH_META_MEM_CACHE.set(meta.symbol, meta);
    return true;
  } catch (error) {
    console.error(`KV write failed for search meta ${key}:`, error);
    return false;
  }
}

async function fetchLiveSearchMeta(symbol, env) {
  try {
    const payload = await fetchSeekingAlphaSearch(symbol);
    const top = payload?.symbols?.[0];
    const meta = sanitizeTopSearchResult(symbol, top);
    if (meta) {
      meta.source = "live";
      await writeSearchMetaToKv(env, meta);
      return meta;
    }
  } catch (error) {
    console.error(`Live search fetch failed for ${symbol}:`, error);
  }

  return null;
}

export async function getSearchMeta(symbol, env, options = {}) {
  const normalizedSymbol = normalizeSymbol(symbol);
  if (!normalizedSymbol) return null;

  const allowFetch = options.allowFetch !== false;

  if (SEARCH_META_MEM_CACHE.has(normalizedSymbol)) {
    return SEARCH_META_MEM_CACHE.get(normalizedSymbol);
  }

  const fromKv = await readSearchMetaFromKv(env, normalizedSymbol);
  if (fromKv) return fromKv;

  if (allowFetch) {
    const live = await fetchLiveSearchMeta(normalizedSymbol, env);
    if (live) return live;
  }

  const fallback = buildFallbackMeta(normalizedSymbol);
  if (fallback) {
    SEARCH_META_MEM_CACHE.set(normalizedSymbol, fallback);
    return fallback;
  }

  return null;
}

export async function getSearchMetaBatch(symbols, env, options = {}) {
  const uniqueSymbols = Array.from(
    new Set((symbols || []).map((symbol) => normalizeSymbol(symbol)).filter(Boolean))
  );

  const results = new Map();
  const missing = [];

  for (const symbol of uniqueSymbols) {
    const meta = await getSearchMeta(symbol, env, { allowFetch: false });
    if (meta) {
      results.set(symbol, meta);
    } else {
      missing.push(symbol);
    }
  }

  if (options.allowFetch === false || !missing.length) {
    return results;
  }

  for (let i = 0; i < missing.length; i += SEARCH_META_BATCH_SIZE) {
    const batch = missing.slice(i, i + SEARCH_META_BATCH_SIZE);
    const settled = await Promise.allSettled(batch.map((symbol) => fetchLiveSearchMeta(symbol, env)));

    settled.forEach((result, index) => {
      const symbol = batch[index];
      if (result.status === "fulfilled" && result.value) {
        results.set(symbol, result.value);
        return;
      }

      const fallback = buildFallbackMeta(symbol);
      if (fallback) {
        results.set(symbol, fallback);
      }
    });

    if (i + SEARCH_META_BATCH_SIZE < missing.length) {
      await sleep(SEARCH_META_BATCH_DELAY_MS);
    }
  }

  return results;
}
