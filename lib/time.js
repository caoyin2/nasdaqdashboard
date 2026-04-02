/**
 * 时间与 K 线工具
 *
 * 重点：
 * - 上游时间字符串统一转成 UTC 毫秒
 * - 没有时区的时间按美东解释
 * - 保留 Worker 全局缓存，减少重复解析成本
 */

import { MARKET_TZ } from "../config.js";

const TIMEKEY_CACHE = globalThis.__TIMEKEY_CACHE__ ?? (globalThis.__TIMEKEY_CACHE__ = new Map());
const TIMEKEY_FIFO = globalThis.__TIMEKEY_FIFO__ ?? (globalThis.__TIMEKEY_FIFO__ = []);
const TIMEKEY_CACHE_MAX = 20000;

function timeKeyCacheSet(key, value) {
  if (TIMEKEY_CACHE.has(key)) return;

  TIMEKEY_CACHE.set(key, value);
  TIMEKEY_FIFO.push(key);

  if (TIMEKEY_FIFO.length > TIMEKEY_CACHE_MAX) {
    const dropped = TIMEKEY_FIFO.splice(0, TIMEKEY_FIFO.length - TIMEKEY_CACHE_MAX);
    for (const oldKey of dropped) TIMEKEY_CACHE.delete(oldKey);
  }
}

const DTF_CACHE = globalThis.__DTF_CACHE__ ?? (globalThis.__DTF_CACHE__ = new Map());

function getDTF(key, factory) {
  let formatter = DTF_CACHE.get(key);
  if (!formatter) {
    formatter = factory();
    DTF_CACHE.set(key, formatter);
  }
  return formatter;
}

const DTF_OFFSET_KEY = `OFFSET|${MARKET_TZ}|en-US`;
const DTF_YMD_NY_KEY = `YMD|${MARKET_TZ}|en-CA`;

const DTF_YMD_NY = getDTF(DTF_YMD_NY_KEY, () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: MARKET_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
);

function tzOffsetMinutesAtUTC(utcMs, tz) {
  const dtf = getDTF(DTF_OFFSET_KEY, () =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
  );

  const parts = dtf.formatToParts(new Date(utcMs));
  const get = (type) => +parts.find((part) => part.type === type)?.value;

  const year = get("year");
  const month = get("month");
  const day = get("day");

  let hour = get("hour");
  const minute = get("minute");
  const second = get("second");

  if (hour === 24) hour = 0;

  const asUTC = Date.UTC(year, month - 1, day, hour, minute, second);
  return (asUTC - utcMs) / 60000;
}

function zonedTimeToUTCms(year, month, day, hour, minute, second, tz) {
  const guessUTC = Date.UTC(year, month - 1, day, hour, minute, second);
  const offset1 = tzOffsetMinutesAtUTC(guessUTC, tz);
  const utc1 = guessUTC - offset1 * 60000;
  const offset2 = tzOffsetMinutesAtUTC(utc1, tz);
  const utc2 = guessUTC - offset2 * 60000;
  return utc2;
}

export function parseTimeKeyToUTCms(key) {
  if (typeof key !== "string") return NaN;

  const cached = TIMEKEY_CACHE.get(key);
  if (cached !== undefined) return cached;

  let result = NaN;

  if (/^\d{4}-\d{2}-\d{2}$/.test(key)) {
    const [yy, mm, dd] = key.split("-").map(Number);
    result = zonedTimeToUTCms(yy, mm, dd, 0, 0, 0, MARKET_TZ);
    timeKeyCacheSet(key, result);
    return result;
  }

  if (/Z$|[+\-]\d{2}:\d{2}$/.test(key)) {
    result = Date.parse(key);
    result = Number.isFinite(result) ? result : NaN;
    timeKeyCacheSet(key, result);
    return result;
  }

  const match = key.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (match) {
    const yy = +match[1];
    const mm = +match[2];
    const dd = +match[3];
    const hh = +match[4];
    const mi = +match[5];
    const ss = +(match[6] ?? 0);

    result = zonedTimeToUTCms(yy, mm, dd, hh, mi, ss, MARKET_TZ);
    timeKeyCacheSet(key, result);
    return result;
  }

  result = Date.parse(key);
  result = Number.isFinite(result) ? result : NaN;
  timeKeyCacheSet(key, result);
  return result;
}

export function parseBarsFromAttributes(attributes) {
  if (!attributes) return [];

  const keys = Object.keys(attributes);
  if (keys.length === 0) return [];

  const sortable = [];
  for (const key of keys) {
    const t = parseTimeKeyToUTCms(key);
    if (!Number.isFinite(t)) continue;
    sortable.push({ key, t });
  }

  sortable.sort((a, b) => a.t - b.t);

  const bars = [];
  for (const item of sortable) {
    const raw = attributes[item.key];
    if (!raw) continue;

    const open = +raw.open;
    const high = +raw.high;
    const low = +raw.low;
    const close = +raw.close;

    if (![open, high, low, close].every(Number.isFinite)) continue;

    bars.push({
      t: item.t,
      open,
      high,
      low,
      close,
      label: item.key,
    });
  }

  return bars;
}

function ymdInTZ(ms, tz) {
  return DTF_YMD_NY.format(new Date(ms));
}

export function fmtUTC(ms) {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate()
  ).padStart(2, "0")} ${String(d.getUTCHours()).padStart(2, "0")}:${String(
    d.getUTCMinutes()
  ).padStart(2, "0")} UTC`;
}

export function pickPrevCloseSmart(dailyBars, barsPeriod) {
  if (!dailyBars || dailyBars.length < 2) return null;
  if (!barsPeriod || barsPeriod.length < 1) return null;

  const dayPeriod = ymdInTZ(barsPeriod[barsPeriod.length - 1].t, MARKET_TZ);
  const dayDailyLast = ymdInTZ(dailyBars[dailyBars.length - 1].t, MARKET_TZ);

  if (dayDailyLast === dayPeriod) return dailyBars[dailyBars.length - 2].close;
  return dailyBars[dailyBars.length - 1].close;
}

export function pickFirstCloseFromBars(bars) {
  if (!bars || bars.length < 1) return null;
  return bars[0].close;
}

export function getLastBar(bars) {
  if (!bars || bars.length < 1) return null;
  return bars[bars.length - 1];
}

export function patchBarsWithLatest1D(barsPeriod, last1D) {
  const output = Array.isArray(barsPeriod) ? barsPeriod.slice() : [];

  if (!last1D || !Number.isFinite(last1D.t) || !Number.isFinite(last1D.close)) {
    return output;
  }

  if (output.length === 0) {
    output.push({
      t: last1D.t,
      open: last1D.close,
      high: last1D.close,
      low: last1D.close,
      close: last1D.close,
      label: "1D_LAST",
    });
    return output;
  }

  const lastPeriodBar = output[output.length - 1];

  if (lastPeriodBar.t === last1D.t) {
    const c = last1D.close;
    output[output.length - 1] = {
      ...lastPeriodBar,
      close: c,
      high: Math.max(lastPeriodBar.high, c),
      low: Math.min(lastPeriodBar.low, c),
    };
    return output;
  }

  if (last1D.t > lastPeriodBar.t) {
    const prev = lastPeriodBar;
    const c = last1D.close;

    output.push({
      t: last1D.t,
      open: prev.close,
      high: Math.max(prev.close, c),
      low: Math.min(prev.close, c),
      close: c,
      label: "1D_LAST",
    });
    return output;
  }

  for (let i = output.length - 1; i >= 0; i--) {
    if (output[i].t === last1D.t) {
      const c = last1D.close;
      output[i] = {
        ...output[i],
        close: c,
        high: Math.max(output[i].high, c),
        low: Math.min(output[i].low, c),
      };
      break;
    }
  }

  return output;
}

