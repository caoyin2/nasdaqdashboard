/**
 * Seeking Alpha 上游请求
 */

import { UPSTREAM } from "../config.js";

const SEEKING_ALPHA_TIMEOUT_MS = 12000;

export async function fetchSeekingAlphaPeriod(period, tickerId) {
  const url = `${UPSTREAM}?period=${encodeURIComponent(period)}&ticker_id=${encodeURIComponent(tickerId)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("Seeking Alpha timeout"), SEEKING_ALPHA_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(url, {
      cf: { cacheTtl: 10, cacheEverything: true },
      headers: {
        "User-Agent": "cf-worker-proxy",
        "Accept": "application/json",
      },
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`SeekingAlpha ${period} ticker_id=${tickerId} timeout after ${SEEKING_ALPHA_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`SeekingAlpha ${period} ticker_id=${tickerId} failed: HTTP ${res.status} ${text.slice(0, 120)}`);
  }

  return res.json();
}
