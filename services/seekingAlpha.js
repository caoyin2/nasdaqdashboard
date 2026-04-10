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

function normalizeSlugs(saSlugs) {
  return Array.from(
    new Set(
      (Array.isArray(saSlugs) ? saSlugs : [saSlugs])
        .map((value) => String(value || "").trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

async function runSlugAttempt(query, label) {
  const slugs = normalizeSlugs(query);
  const url = `https://finance-api.seekingalpha.com/real_time_quotes?sa_slugs=${encodeURIComponent(slugs.join(","))}`;

  try {
    const res = await fetchWithTimeout(url, label, {
      headers: buildChartHeaders(),
    });
    const text = await res.text();

    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }

    const first = json?.real_time_quotes?.[0] ?? null;

    return {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      quotesCount: Array.isArray(json?.real_time_quotes) ? json.real_time_quotes.length : 0,
      firstQuote: first
        ? {
            ticker_id: first.ticker_id ?? null,
            sa_id: first.sa_id ?? null,
            sa_slug: first.sa_slug ?? null,
            symbol: first.symbol ?? null,
          }
        : null,
      bodySnippet: text.slice(0, 240),
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      statusText: null,
      quotesCount: 0,
      firstQuote: null,
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

export async function fetchSeekingAlphaRealTimeQuotes(saIds) {
  const ids = Array.from(
    new Set(
      (Array.isArray(saIds) ? saIds : [saIds])
        .map((value) => Number.parseInt(value, 10))
        .filter((value) => Number.isFinite(value) && value > 0)
    )
  );

  if (!ids.length) {
    return [];
  }

  const url = `https://finance-api.seekingalpha.com/real_time_quotes?sa_ids=${ids.join(",")}`;
  const res = await fetchWithTimeout(url, `SeekingAlpha real_time_quotes ${ids.join(",")}`, {
    headers: buildChartHeaders(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`SeekingAlpha real_time_quotes failed: HTTP ${res.status} ${text.slice(0, 120)}`);
  }

  const json = await res.json();
  return Array.isArray(json?.real_time_quotes) ? json.real_time_quotes : [];
}

export async function fetchSeekingAlphaRealTimeQuotesBySlugs(saSlugs) {
  const slugs = normalizeSlugs(saSlugs);

  if (!slugs.length) {
    return [];
  }

  const url = `https://finance-api.seekingalpha.com/real_time_quotes?sa_slugs=${encodeURIComponent(slugs.join(","))}`;
  const res = await fetchWithTimeout(url, `SeekingAlpha real_time_quotes slugs ${slugs.join(",")}`, {
    headers: buildChartHeaders(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`SeekingAlpha real_time_quotes by slug failed: HTTP ${res.status} ${text.slice(0, 120)}`);
  }

  const json = await res.json();
  return Array.isArray(json?.real_time_quotes) ? json.real_time_quotes : [];
}

export async function probeSeekingAlphaSlugs(query, options = {}) {
  const sequentialCount = Math.max(1, Math.min(6, Number.parseInt(options.sequentialCount ?? "3", 10) || 3));
  const parallelCount = Math.max(1, Math.min(6, Number.parseInt(options.parallelCount ?? "3", 10) || 3));

  const single = await runSlugAttempt(query, `SeekingAlpha slug probe single ${query}`);

  const sequential = [];
  for (let i = 0; i < sequentialCount; i += 1) {
    sequential.push(await runSlugAttempt(query, `SeekingAlpha slug probe sequential ${query} #${i + 1}`));
  }

  const parallel = await Promise.all(
    Array.from({ length: parallelCount }, (_, i) =>
      runSlugAttempt(query, `SeekingAlpha slug probe parallel ${query} #${i + 1}`)
    )
  );

  return {
    ok: true,
    query: String(query || "").trim(),
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
