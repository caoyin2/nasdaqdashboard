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
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    ...(options.headers || {}),
  };

  let res;
  try {
    res = await fetch(url, {
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

function buildSearchUrl(query) {
  return `https://seekingalpha.com/api/v3/searches?filter[query]=${encodeURIComponent(query)}&filter[type]=symbols`;
}

function buildSearchHeaders() {
  return {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://seekingalpha.com/",
    "Origin": "https://seekingalpha.com",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
  };
}

function buildChartHeaders() {
  return {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://seekingalpha.com/",
    "Origin": "https://seekingalpha.com",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-site",
  };
}

async function runSearchAttempt(query, label) {
  const url = buildSearchUrl(query);
  try {
    const res = await fetchWithTimeout(url, label, {
      headers: buildSearchHeaders(),
    });
    const text = await res.text();

    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }

    const first = json?.symbols?.[0] ?? null;

    return {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      symbolsCount: Array.isArray(json?.symbols) ? json.symbols.length : 0,
      firstSymbol: first
        ? {
            id: first.id ?? null,
            slug: first.slug ?? null,
            content: first.content ?? null,
          }
        : null,
      bodySnippet: text.slice(0, 240),
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      statusText: null,
      symbolsCount: 0,
      firstSymbol: null,
      bodySnippet: "",
      error: error?.message || String(error),
    };
  }
}

export async function fetchSeekingAlphaPeriod(period, tickerId) {
  const url = `${UPSTREAM}?period=${encodeURIComponent(period)}&ticker_id=${encodeURIComponent(tickerId)}`;
  const res = await fetchWithTimeout(url, `SeekingAlpha ${period} ticker_id=${tickerId}`, {
    headers: buildChartHeaders(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`SeekingAlpha ${period} ticker_id=${tickerId} failed: HTTP ${res.status} ${text.slice(0, 120)}`);
  }

  return res.json();
}

export async function fetchSeekingAlphaSearch(query) {
  const url = buildSearchUrl(query);
  const res = await fetchWithTimeout(url, `SeekingAlpha search ${query}`, {
    headers: buildSearchHeaders(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`SeekingAlpha search ${query} failed: HTTP ${res.status} ${text.slice(0, 120)}`);
  }

  return res.json();
}

export async function probeSeekingAlphaSearch(query, options = {}) {
  const sequentialCount = Math.max(1, Math.min(6, Number.parseInt(options.sequentialCount ?? "3", 10) || 3));
  const parallelCount = Math.max(1, Math.min(6, Number.parseInt(options.parallelCount ?? "3", 10) || 3));

  const single = await runSearchAttempt(query, `SeekingAlpha search probe single ${query}`);

  const sequential = [];
  for (let i = 0; i < sequentialCount; i += 1) {
    sequential.push(await runSearchAttempt(query, `SeekingAlpha search probe sequential ${query} #${i + 1}`));
  }

  const parallel = await Promise.all(
    Array.from({ length: parallelCount }, (_, i) =>
      runSearchAttempt(query, `SeekingAlpha search probe parallel ${query} #${i + 1}`)
    )
  );

  return {
    ok: true,
    query,
    testedAt: new Date().toISOString(),
    single,
    sequential,
    parallel,
    summary: {
      singleOk: !!single?.ok,
      sequentialOkCount: sequential.filter((item) => item.ok).length,
      parallelOkCount: parallel.filter((item) => item.ok).length,
    },
  };
}
