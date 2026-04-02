/**
 * Seeking Alpha 上游请求
 */

import { UPSTREAM } from "../config.js";

export async function fetchSeekingAlphaPeriod(period, tickerId) {
  const url = `${UPSTREAM}?period=${encodeURIComponent(period)}&ticker_id=${encodeURIComponent(tickerId)}`;

  const res = await fetch(url, {
    cf: { cacheTtl: 10, cacheEverything: true },
    headers: {
      "User-Agent": "cf-worker-proxy",
      "Accept": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`SeekingAlpha ${period} ticker_id=${tickerId} failed: HTTP ${res.status} ${text.slice(0, 120)}`);
  }

  return res.json();
}

