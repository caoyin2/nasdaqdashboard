/**
 * Star-tech company list storage.
 *
 * The panel should read the list from Worker KV on every request, instead of
 * treating the code-side fallback list as the primary source of truth.
 *
 * KV key:
 *   index:star-tech:list
 *
 * Fallback behavior:
 * - If the KV key is missing or invalid, seed it once from config.
 * - Do not keep a separate in-memory cache for the list.
 */

import { STAR_TECH_COMPANIES } from "../config.js";
import { fetchSeekingAlphaSearch } from "./seekingAlpha.js";
import { getKvBinding } from "./kvBinding.js";
import { writeSearchMetaToKv } from "./searchMetaStore.js";

export const STAR_TECH_LIST_KEY = "index:star-tech:list";

function normalizeCompany(item) {
  const symbol = String(item?.symbol || "").trim().toUpperCase();
  const nameCN = String(item?.nameCN || "").trim();
  if (!symbol || !nameCN) return null;
  return { symbol, nameCN };
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
    source: "live",
  };
}

function getSearchSymbolCandidate(top) {
  const slug = String(top?.slug || "").trim().toUpperCase();
  if (slug) return slug;

  const urlMatch = String(top?.url || "").match(/\/symbol\/([^/?#]+)/i);
  if (urlMatch?.[1]) return String(urlMatch[1]).trim().toUpperCase();

  const nameText = String(top?.name || "").replace(/<[^>]+>/g, "").trim().toUpperCase();
  if (nameText && /^[A-Z0-9.\-]+$/.test(nameText)) return nameText;

  return "";
}

async function validateAndSeedSearchMeta(symbol) {
  const payload = await fetchSeekingAlphaSearch(symbol);
  const top = payload?.symbols?.[0];
  if (!top) {
    throw new Error(`Symbol ${symbol} not found in search`);
  }

  const matchedSymbol = getSearchSymbolCandidate(top);
  if (matchedSymbol !== symbol) {
    throw new Error(`Search top result mismatch: expected ${symbol}, got ${matchedSymbol || "unknown"}`);
  }

  const meta = sanitizeTopSearchResult(symbol, top);
  if (!meta?.tickerId) {
    throw new Error(`Search result for ${symbol} has no tickerId`);
  }

  return {
    meta,
    fallbackName: meta.nameEn,
  };
}

function normalizeCompanyList(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map(normalizeCompany)
    .filter(Boolean);
}

export async function readStarTechListFromKv(env) {
  const kv = getKvBinding(env);
  if (!kv || typeof kv.get !== "function") {
    return null;
  }

  try {
    const raw = await kv.get(STAR_TECH_LIST_KEY);
    if (raw == null) return null;

    const parsed = JSON.parse(raw);
    const list = normalizeCompanyList(parsed);
    return list.length ? list : null;
  } catch (error) {
    console.error(`KV read failed for ${STAR_TECH_LIST_KEY}:`, error);
    return null;
  }
}

export async function writeStarTechListToKv(env, list) {
  const kv = getKvBinding(env);
  if (!kv || typeof kv.put !== "function") {
    return false;
  }

  const normalized = normalizeCompanyList(list);

  try {
    await kv.put(STAR_TECH_LIST_KEY, JSON.stringify(normalized), {
      metadata: {
        kind: "star-tech-list",
        count: normalized.length,
      },
    });
    return true;
  } catch (error) {
    console.error(`KV write failed for ${STAR_TECH_LIST_KEY}:`, error);
    return false;
  }
}

export async function getStarTechCompanyList(env) {
  const fromKv = await readStarTechListFromKv(env);
  if (fromKv?.length) {
    return fromKv;
  }

  const fallback = normalizeCompanyList(STAR_TECH_COMPANIES);
  if (fallback.length) {
    await writeStarTechListToKv(env, fallback);
  }
  return fallback;
}

export async function setStarTechCompanyList(env, list) {
  const normalized = normalizeCompanyList(list);
  await writeStarTechListToKv(env, normalized);
  return normalized;
}

export async function addStarTechCompany(env, item) {
  const symbol = String(item?.symbol || "").trim().toUpperCase();
  const inputNameCN = String(item?.nameCN || "").trim();
  if (!symbol) {
    throw new Error("Missing symbol");
  }

  const current = await getStarTechCompanyList(env);
  if (current.some((entry) => entry.symbol === symbol)) {
    throw new Error(`Symbol ${symbol} already exists`);
  }

  const validation = await validateAndSeedSearchMeta(symbol);
  await writeSearchMetaToKv(env, validation.meta);

  const company = {
    symbol,
    nameCN: inputNameCN || validation.fallbackName,
  };

  const next = current.concat(company);
  await writeStarTechListToKv(env, next);
  return next;
}

export async function removeStarTechCompany(env, symbol) {
  const normalizedSymbol = String(symbol || "").trim().toUpperCase();
  if (!normalizedSymbol) {
    throw new Error("Missing symbol");
  }

  const current = await getStarTechCompanyList(env);
  const next = current.filter((entry) => entry.symbol !== normalizedSymbol);

  if (next.length === current.length) {
    throw new Error(`Symbol ${normalizedSymbol} not found`);
  }

  await writeStarTechListToKv(env, next);
  return next;
}
