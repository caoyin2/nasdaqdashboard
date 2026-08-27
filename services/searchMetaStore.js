import { fetchSeekingAlphaRealTimeQuotesBySlugs } from "./seekingAlpha.js";
import { INDEX_WEIGHTS_FALLBACK_META } from "./indexWeightsFallback.js";
import { getKvBinding } from "./kvBinding.js";

const SEARCH_META_PREFIX = "search:";
const SEARCH_META_BATCH_SIZE = 2;
const SEARCH_META_BATCH_DELAY_MS = 5000;
const SEARCH_META_KV_BULK_READ_SIZE = 100;
const SEARCH_META_MAX_FETCH_BATCH_SIZE = 100;
const SEARCH_META_SLUG_ALIASES = Object.freeze({
  BRKB: "brk.b",
  BFB: "bf.b",
});
const SEARCH_META_MEM_CACHE =
  globalThis.__SEARCH_META_MEM_CACHE__ ?? (globalThis.__SEARCH_META_MEM_CACHE__ = new Map());

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeSymbol(symbol) {
  return String(symbol || "").trim().toUpperCase();
}

function buildDefaultIconLight(symbol) {
  return `https://static.seekingalpha.com/cdn/s3/company_logos/mark_vector_light/${encodeURIComponent(symbol)}.svg`;
}

function buildDefaultIconDark(symbol) {
  return `https://static.seekingalpha.com/cdn/s3/company_logos/mark_vector_dark/${encodeURIComponent(symbol)}.svg`;
}

function hasStoredIcon(value) {
  return [value?.iconLight, value?.iconDark].some(
    (icon) => typeof icon === "string" && icon.trim().length > 0
  );
}

function getSearchMetaLookupSlug(symbol) {
  const normalizedSymbol = normalizeSymbol(symbol);
  return SEARCH_META_SLUG_ALIASES[normalizedSymbol] || normalizedSymbol.toLowerCase();
}

function normalizeMetaIdentifier(value) {
  return normalizeSymbol(value).replace(/\//g, ".");
}

function normalizeStoredMeta(symbol, value) {
  return {
    symbol: normalizeSymbol(value?.symbol || symbol),
    tickerId: Number.isFinite(+value?.tickerId) ? +value.tickerId : null,
    nameEn: String(value?.nameEn || normalizeSymbol(symbol)).trim(),
    slug: String(value?.slug || normalizeSymbol(symbol)).trim().toLowerCase(),
    iconLight: value?.iconLight || buildDefaultIconLight(symbol),
    iconDark: value?.iconDark || buildDefaultIconDark(symbol),
    hasStoredIcon: hasStoredIcon(value),
    updatedAt: value?.updatedAt || null,
    source: value?.source || "kv",
  };
}

function buildFallbackMeta(symbol) {
  const fallback = INDEX_WEIGHTS_FALLBACK_META[symbol];
  if (!fallback) return null;

  return normalizeStoredMeta(symbol, {
    symbol,
    tickerId: fallback.tickerId,
    nameEn: fallback.nameEn || symbol,
    slug: fallback.slug || symbol.toLowerCase(),
    iconLight: fallback.iconLight || buildDefaultIconLight(symbol),
    iconDark: fallback.iconDark || buildDefaultIconDark(symbol),
    updatedAt: new Date().toISOString(),
    source: "fallback",
  });
}

function buildMetaFromQuote(symbol, quote, baseMeta = null) {
  const normalizedSymbol = normalizeSymbol(symbol);
  const expectedSymbol = normalizeMetaIdentifier(normalizedSymbol);
  const expectedLookupSlug = normalizeMetaIdentifier(getSearchMetaLookupSlug(normalizedSymbol));
  const quoteSymbol = normalizeMetaIdentifier(quote?.symbol);
  const quoteSlug = normalizeMetaIdentifier(quote?.sa_slug);
  if (![quoteSymbol, quoteSlug].includes(expectedSymbol) && ![quoteSymbol, quoteSlug].includes(expectedLookupSlug)) {
    return null;
  }

  const tickerId = Number.isFinite(+quote?.ticker_id)
    ? +quote.ticker_id
    : (Number.isFinite(+quote?.sa_id) ? +quote.sa_id : null);

  if (!tickerId) {
    return null;
  }

  const quoteIconSymbol = normalizeSymbol(quote?.symbol || normalizedSymbol);

  return normalizeStoredMeta(normalizedSymbol, {
    symbol: normalizedSymbol,
    tickerId,
    nameEn: baseMeta?.nameEn || normalizedSymbol,
    slug: String(quote?.sa_slug || normalizedSymbol).trim().toLowerCase(),
    iconLight: buildDefaultIconLight(quoteIconSymbol),
    iconDark: buildDefaultIconDark(quoteIconSymbol),
    updatedAt: new Date().toISOString(),
    source: "live-slug",
  });
}

function buildUnresolvedMeta(symbol, baseMeta = null) {
  const normalizedSymbol = normalizeSymbol(symbol);
  return normalizeStoredMeta(normalizedSymbol, {
    symbol: normalizedSymbol,
    tickerId: baseMeta?.tickerId ?? null,
    nameEn: baseMeta?.nameEn || normalizedSymbol,
    slug: baseMeta?.slug || getSearchMetaLookupSlug(normalizedSymbol),
    iconLight: baseMeta?.iconLight || buildDefaultIconLight(normalizedSymbol),
    iconDark: baseMeta?.iconDark || buildDefaultIconDark(normalizedSymbol),
    updatedAt: new Date().toISOString(),
    source: "live-unresolved",
  });
}

export function getSearchMetaKey(symbol) {
  return `${SEARCH_META_PREFIX}${normalizeSymbol(symbol)}`;
}

export async function readSearchMetaFromKv(env, symbol) {
  const key = getSearchMetaKey(symbol);
  const kv = getKvBinding(env);
  if (!kv || typeof kv.get !== "function") {
    return null;
  }

  try {
    const raw = await kv.get(key);
    if (raw == null) return null;

    const value = JSON.parse(raw);
    const normalized = normalizeStoredMeta(symbol, value);
    SEARCH_META_MEM_CACHE.set(normalized.symbol, normalized);
    return normalized;
  } catch (error) {
    console.error(`KV read failed for search meta ${key}:`, error);
    return null;
  }
}

async function readSearchMetaBatchFromKv(env, symbols) {
  const kv = getKvBinding(env);
  const results = new Map();
  if (!kv || typeof kv.get !== "function" || !symbols.length) {
    return results;
  }

  for (let i = 0; i < symbols.length; i += SEARCH_META_KV_BULK_READ_SIZE) {
    const batch = symbols.slice(i, i + SEARCH_META_KV_BULK_READ_SIZE);
    const keys = batch.map((symbol) => getSearchMetaKey(symbol));

    try {
      const values = await kv.get(keys);
      for (let index = 0; index < batch.length; index += 1) {
        const symbol = batch[index];
        const raw = values?.get?.(keys[index]) ?? null;
        if (raw == null) continue;

        try {
          const normalized = normalizeStoredMeta(symbol, JSON.parse(raw));
          SEARCH_META_MEM_CACHE.set(normalized.symbol, normalized);
          results.set(symbol, normalized);
        } catch (error) {
          console.error(`KV bulk value parse failed for search meta ${keys[index]}:`, error);
        }
      }
    } catch (error) {
      console.error("KV bulk read failed for search meta batch:", error);
    }
  }

  return results;
}

export async function writeSearchMetaToKv(env, meta) {
  const kv = getKvBinding(env);
  if (!kv || typeof kv.put !== "function" || !meta?.symbol) {
    return false;
  }

  const normalized = normalizeStoredMeta(meta.symbol, meta);
  const key = getSearchMetaKey(normalized.symbol);

  try {
    await kv.put(key, JSON.stringify(normalized), {
      metadata: {
        kind: "search-meta",
        symbol: normalized.symbol,
      },
    });
    SEARCH_META_MEM_CACHE.set(normalized.symbol, normalized);
    return true;
  } catch (error) {
    console.error(`KV write failed for search meta ${key}:`, error);
    return false;
  }
}

async function fetchLiveSlugMeta(symbol, env) {
  const normalizedSymbol = normalizeSymbol(symbol);
  const kvMeta = await readSearchMetaFromKv(env, normalizedSymbol);
  const cached = SEARCH_META_MEM_CACHE.get(normalizedSymbol) || null;
  const fallback = buildFallbackMeta(normalizedSymbol);
  const baseMeta = kvMeta || cached || fallback || null;

  try {
    const quotes = await fetchSeekingAlphaRealTimeQuotesBySlugs(normalizedSymbol.toLowerCase());
    const quote = Array.isArray(quotes)
      ? quotes.find((item) => normalizeSymbol(item?.symbol || item?.sa_slug) === normalizedSymbol)
      : null;
    const meta = buildMetaFromQuote(normalizedSymbol, quote, baseMeta);
    if (meta) {
      await writeSearchMetaToKv(env, meta);
      return meta;
    }
  } catch (error) {
    console.error(`Live slug metadata fetch failed for ${normalizedSymbol}:`, error);
  }

  return null;
}

export async function refreshSearchMeta(symbol, env) {
  const normalizedSymbol = normalizeSymbol(symbol);
  if (!normalizedSymbol) return null;
  return fetchLiveSlugMeta(normalizedSymbol, env);
}

export async function getSearchMeta(symbol, env, options = {}) {
  const normalizedSymbol = normalizeSymbol(symbol);
  if (!normalizedSymbol) return null;

  const allowFetch = options.allowFetch !== false;
  const allowFallback = options.allowFallback !== false;
  const cached = SEARCH_META_MEM_CACHE.get(normalizedSymbol) || null;

  if (cached?.tickerId && cached.source !== "fallback") {
    return cached;
  }

  const fromKv = await readSearchMetaFromKv(env, normalizedSymbol);
  if (fromKv?.tickerId) return fromKv;

  if (allowFetch) {
    const live = await fetchLiveSlugMeta(normalizedSymbol, env);
    if (live?.tickerId) return live;
  }

  if (fromKv) return fromKv;
  if (cached && allowFallback) return cached;

  if (allowFallback) {
    const fallback = buildFallbackMeta(normalizedSymbol);
    if (fallback) {
      SEARCH_META_MEM_CACHE.set(normalizedSymbol, fallback);
      return fallback;
    }
  }

  return null;
}

export async function getSearchMetaBatch(symbols, env, options = {}) {
  const uniqueSymbols = Array.from(
    new Set((symbols || []).map((symbol) => normalizeSymbol(symbol)).filter(Boolean))
  );

  const results = new Map();
  const missing = [];
  const symbolsWithoutFreshMemoryCache = [];
  const requireKvIcon = options.requireKvIcon === true;
  const requestedBatchSize = Number.parseInt(options.fetchBatchSize, 10);
  const fetchBatchSize = Number.isFinite(requestedBatchSize)
    ? Math.max(1, Math.min(SEARCH_META_MAX_FETCH_BATCH_SIZE, requestedBatchSize))
    : SEARCH_META_BATCH_SIZE;
  const requestedBatchDelayMs = Number.parseInt(options.fetchBatchDelayMs, 10);
  const fetchBatchDelayMs = Number.isFinite(requestedBatchDelayMs)
    ? Math.max(0, requestedBatchDelayMs)
    : SEARCH_META_BATCH_DELAY_MS;

  for (const symbol of uniqueSymbols) {
    const cached = SEARCH_META_MEM_CACHE.get(symbol) || null;
    if (!requireKvIcon && cached?.tickerId && cached.source !== "fallback") {
      results.set(symbol, cached);
      continue;
    }
    symbolsWithoutFreshMemoryCache.push(symbol);
  }

  const kvResults = await readSearchMetaBatchFromKv(env, symbolsWithoutFreshMemoryCache);
  for (const symbol of symbolsWithoutFreshMemoryCache) {
    const meta = kvResults.get(symbol) || null;
    const hasKvMetadata = requireKvIcon ? meta?.hasStoredIcon : meta?.tickerId;
    if (hasKvMetadata) results.set(symbol, meta);
    else missing.push(symbol);
  }

  if (options.allowFetch === false || !missing.length) {
    return results;
  }

  for (let i = 0; i < missing.length; i += fetchBatchSize) {
    const batch = missing.slice(i, i + fetchBatchSize);
    const pendingWrites = [];
    const quotes = await fetchSeekingAlphaRealTimeQuotesBySlugs(batch.map(getSearchMetaLookupSlug)).catch((error) => {
      console.error(`Batch slug metadata fetch failed for ${batch.join(", ")}:`, error);
      return [];
    });
    const quoteMap = new Map(
      (Array.isArray(quotes) ? quotes : [])
        .flatMap((quote) => [
          [normalizeMetaIdentifier(quote?.symbol), quote],
          [normalizeMetaIdentifier(quote?.sa_slug), quote],
        ])
    );

    for (const symbol of batch) {
      const kvMeta = kvResults.get(symbol) || null;
      const cached = SEARCH_META_MEM_CACHE.get(symbol) || null;
      const fallback = buildFallbackMeta(symbol);
      const lookupSlug = getSearchMetaLookupSlug(symbol);
      const meta = buildMetaFromQuote(
        symbol,
        quoteMap.get(normalizeMetaIdentifier(symbol)) || quoteMap.get(normalizeMetaIdentifier(lookupSlug)),
        kvMeta || cached || fallback || null
      );

      if (meta) {
        pendingWrites.push(writeSearchMetaToKv(env, meta));
        results.set(symbol, meta);
        continue;
      }

      if (options.persistUnresolvedIcon === true) {
        const unresolved = buildUnresolvedMeta(symbol, kvMeta || cached || fallback || null);
        pendingWrites.push(writeSearchMetaToKv(env, unresolved));
        results.set(symbol, unresolved);
        continue;
      }

      if (kvMeta) {
        results.set(symbol, kvMeta);
        continue;
      }

      if (fallback) {
        SEARCH_META_MEM_CACHE.set(symbol, fallback);
        results.set(symbol, fallback);
      }
    }

    await Promise.all(pendingWrites);

    if (fetchBatchDelayMs > 0 && i + fetchBatchSize < missing.length) {
      await sleep(fetchBatchDelayMs);
    }
  }

  return results;
}
