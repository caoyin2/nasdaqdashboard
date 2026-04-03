/**
 * Seeking Alpha 上游请求
 */

import { UPSTREAM } from "../config.js";

const SEEKING_ALPHA_TIMEOUT_MS = 12000;

async function fetchWithTimeout(url, label, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(`${label} timeout`), SEEKING_ALPHA_TIMEOUT_MS);
  const headers = {
    "User-Agent": "cf-worker-proxy",
    "Accept": "application/json",
    ...(options.headers || {}),
  };

  let res;
  try {
    res = await fetch(url, {
      cf: { cacheTtl: 10, cacheEverything: true },
      headers,
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`${label} timeout after ${SEEKING_ALPHA_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }

  return res;
}

export async function fetchSeekingAlphaPeriod(period, tickerId) {
  const url = `${UPSTREAM}?period=${encodeURIComponent(period)}&ticker_id=${encodeURIComponent(tickerId)}`;
  const res = await fetchWithTimeout(url, `SeekingAlpha ${period} ticker_id=${tickerId}`);

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`SeekingAlpha ${period} ticker_id=${tickerId} failed: HTTP ${res.status} ${text.slice(0, 120)}`);
  }

  return res.json();
}

export async function fetchSeekingAlphaSearch(query) {
  const url =
    `https://seekingalpha.com/api/v3/searches?filter[query]=${encodeURIComponent(query)}&filter[type]=symbols`;
  const res = await fetchWithTimeout(url, `SeekingAlpha search ${query}`, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      "Referer": "https://seekingalpha.com/",
      "Origin": "https://seekingalpha.com",
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-origin",
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`SeekingAlpha search ${query} failed: HTTP ${res.status} ${text.slice(0, 120)}`);
  }

  return res.json();
}
