/**
 * Fund premium list storage.
 *
 * The configured fund list lives in Worker KV. The config list is only used
 * to seed a new namespace and to keep the panel usable if KV is unavailable.
 */

import { FUND_LOGO_OPTIONS, FUND_PREMIUM_FUNDS } from "../config.js";
import { getKvBinding } from "./kvBinding.js";

export const FUND_PREMIUM_LIST_KEY = "fund-premium:list";
const MAX_FUND_COUNT = 50;
const FUND_LOGO_CODES = new Set(FUND_LOGO_OPTIONS.map((option) => option.code));

function normalizeFund(item) {
  const code = String(item?.code || "").trim();
  const fallbackName = String(item?.fallbackName || item?.nameCN || "").trim();
  const iconCode = String(item?.iconCode || "").trim();

  if (!/^\d{6}$/.test(code) || !fallbackName || (iconCode && !FUND_LOGO_CODES.has(iconCode))) return null;
  return iconCode ? { code, fallbackName, iconCode } : { code, fallbackName };
}

function normalizeFundList(items) {
  if (!Array.isArray(items)) return [];

  const seen = new Set();
  return items.reduce((list, item) => {
    const fund = normalizeFund(item);
    if (!fund || seen.has(fund.code)) return list;
    seen.add(fund.code);
    list.push(fund);
    return list;
  }, []);
}

export async function readFundPremiumListFromKv(env) {
  const kv = getKvBinding(env);
  if (!kv || typeof kv.get !== "function") return null;

  try {
    const raw = await kv.get(FUND_PREMIUM_LIST_KEY);
    if (raw == null) return null;

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;

    const list = normalizeFundList(parsed);
    return parsed.length && !list.length ? null : list;
  } catch (error) {
    console.error(`KV read failed for ${FUND_PREMIUM_LIST_KEY}:`, error);
    return null;
  }
}

export async function writeFundPremiumListToKv(env, list) {
  const kv = getKvBinding(env);
  if (!kv || typeof kv.put !== "function") return false;

  const normalized = normalizeFundList(list);
  try {
    await kv.put(FUND_PREMIUM_LIST_KEY, JSON.stringify(normalized), {
      metadata: {
        kind: "fund-premium-list",
        count: normalized.length,
      },
    });
    return true;
  } catch (error) {
    console.error(`KV write failed for ${FUND_PREMIUM_LIST_KEY}:`, error);
    return false;
  }
}

export async function getFundPremiumFundList(env) {
  const fromKv = await readFundPremiumListFromKv(env);
  if (fromKv !== null) return fromKv;

  const fallback = normalizeFundList(FUND_PREMIUM_FUNDS);
  await writeFundPremiumListToKv(env, fallback);
  return fallback;
}

export async function addFundPremiumFund(env, item) {
  const requestedIconCode = String(item?.iconCode || "").trim();
  if (!FUND_LOGO_CODES.has(requestedIconCode)) {
    throw new Error("Select a fund company icon");
  }

  const fund = normalizeFund(item);
  if (!fund) {
    throw new Error("Fund code must be six digits and Chinese name is required");
  }

  const current = await getFundPremiumFundList(env);
  if (current.some((entry) => entry.code === fund.code)) {
    throw new Error(`Fund ${fund.code} already exists`);
  }
  if (current.length >= MAX_FUND_COUNT) {
    throw new Error(`Fund list cannot exceed ${MAX_FUND_COUNT} items`);
  }

  const next = current.concat(fund);
  if (!(await writeFundPremiumListToKv(env, next))) {
    throw new Error("Worker KV is unavailable; fund list was not saved");
  }
  return next;
}

export function getFundLogoOptions() {
  return FUND_LOGO_OPTIONS;
}

export async function removeFundPremiumFund(env, code) {
  const normalizedCode = String(code || "").trim();
  if (!/^\d{6}$/.test(normalizedCode)) {
    throw new Error("Fund code must be six digits");
  }

  const current = await getFundPremiumFundList(env);
  const next = current.filter((entry) => entry.code !== normalizedCode);
  if (next.length === current.length) {
    throw new Error(`Fund ${normalizedCode} not found`);
  }
  if (!(await writeFundPremiumListToKv(env, next))) {
    throw new Error("Worker KV is unavailable; fund list was not saved");
  }
  return next;
}
