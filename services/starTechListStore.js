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
import { getKvBinding } from "./kvBinding.js";

export const STAR_TECH_LIST_KEY = "index:star-tech:list";

function normalizeCompany(item) {
  const symbol = String(item?.symbol || "").trim().toUpperCase();
  const nameCN = String(item?.nameCN || "").trim();
  if (!symbol || !nameCN) return null;
  return { symbol, nameCN };
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
  if (!normalized.length) {
    return false;
  }

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
