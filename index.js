/**
 * Worker 主入口
 *
 * 这个文件只做三件事：
 * 1. 处理路由
 * 2. 处理 /api/quote 的内存缓存与 edge cache
 * 3. 调用真正的业务函数 buildQuotePayload(period)
 */

import { API_MEM_TTL_MS, normalizePeriod } from "./config.js";
import { corsHeaders, htmlResponse, jsonResponse } from "./lib/http.js";
import { fetchCnnFearGreedSummary } from "./services/cnnFearGreed.js";
import { buildIndexWeightsPayload } from "./services/indexWeightsService.js";
import { buildQuotePayload } from "./services/quoteService.js";
import { probeSeekingAlphaSearch } from "./services/seekingAlpha.js";
import { buildStarTechPayload } from "./services/starTechService.js";
import { getClientScript } from "./ui/client.js";
import { getHtml } from "./ui/html.js";

const API_MEM_CACHE = globalThis.__API_MEM_CACHE__ ?? (globalThis.__API_MEM_CACHE__ = new Map());
const FEAR_GREED_MEM_CACHE =
  globalThis.__FEAR_GREED_MEM_CACHE__ ?? (globalThis.__FEAR_GREED_MEM_CACHE__ = new Map());
const STAR_TECH_MEM_CACHE =
  globalThis.__STAR_TECH_MEM_CACHE__ ?? (globalThis.__STAR_TECH_MEM_CACHE__ = new Map());
const INDEX_WEIGHTS_MEM_CACHE =
  globalThis.__INDEX_WEIGHTS_MEM_CACHE__ ?? (globalThis.__INDEX_WEIGHTS_MEM_CACHE__ = new Map());
const FEAR_GREED_MEM_TTL_MS = 5 * 60 * 1000;
const FEAR_GREED_CACHE_SECONDS = 5 * 60;
const STAR_TECH_CACHE = {
  "1D": { memTtlMs: 25 * 1000, cacheSeconds: 25 },
  default: { memTtlMs: 10 * 60 * 1000, cacheSeconds: 10 * 60 },
};
const INDEX_WEIGHTS_MEM_TTL_MS = 12 * 60 * 60 * 1000;
const INDEX_WEIGHTS_CACHE_SECONDS = 12 * 60 * 60;

function getKvBinding(env) {
  const kv = env?.NasdaqDashboard;
  if (!kv || typeof kv.get !== "function" || typeof kv.put !== "function") {
    return null;
  }
  return kv;
}

async function handleKvRoute(request, url, origin, env) {
  const kv = getKvBinding(env);
  if (!kv) {
    return jsonResponse(
      {
        ok: false,
        error: "KV binding NasdaqDashboard is not configured on this Worker",
      },
      origin,
      500,
      { cacheSeconds: 0 }
    );
  }

  if (request.method === "GET") {
    const key = url.searchParams.get("key");
    const prefix = url.searchParams.get("prefix");

    if (key) {
      const raw = await kv.get(key);
      if (raw == null) {
        return jsonResponse({ ok: true, found: false, key }, origin, 200, { cacheSeconds: 0 });
      }

      let value = raw;
      try {
        value = JSON.parse(raw);
      } catch {
        value = raw;
      }

      return jsonResponse({ ok: true, found: true, key, value }, origin, 200, { cacheSeconds: 0 });
    }

    if (prefix != null) {
      const limit = Math.max(1, Math.min(100, Number.parseInt(url.searchParams.get("limit") || "50", 10) || 50));
      const listed = await kv.list({ prefix, limit });
      return jsonResponse(
        {
          ok: true,
          prefix,
          keys: listed.keys.map((item) => ({
            name: item.name,
            expiration: item.expiration ?? null,
            metadata: item.metadata ?? null,
          })),
          listComplete: listed.list_complete,
          cursor: listed.cursor || null,
        },
        origin,
        200,
        { cacheSeconds: 0 }
      );
    }

    return jsonResponse(
      { ok: false, error: "Provide either ?key=... or ?prefix=..." },
      origin,
      400,
      { cacheSeconds: 0 }
    );
  }

  if (request.method === "POST") {
    let payload;
    try {
      payload = await request.json();
    } catch {
      return jsonResponse({ ok: false, error: "Invalid JSON body" }, origin, 400, { cacheSeconds: 0 });
    }

    const key = String(payload?.key || "").trim();
    if (!key) {
      return jsonResponse({ ok: false, error: "Missing key" }, origin, 400, { cacheSeconds: 0 });
    }

    const value = typeof payload.value === "string" ? payload.value : JSON.stringify(payload.value);
    const options = {};
    if (payload.expirationTtl != null) {
      options.expirationTtl = payload.expirationTtl;
    }
    if (payload.metadata != null) {
      options.metadata = payload.metadata;
    }

    await kv.put(key, value, options);

    return jsonResponse({ ok: true, key, written: true }, origin, 200, { cacheSeconds: 0 });
  }

  if (request.method === "DELETE") {
    const key = String(url.searchParams.get("key") || "").trim();
    if (!key) {
      return jsonResponse({ ok: false, error: "Missing key" }, origin, 400, { cacheSeconds: 0 });
    }

    await kv.delete(key);
    return jsonResponse({ ok: true, key, deleted: true }, origin, 200, { cacheSeconds: 0 });
  }

  return new Response("Method Not Allowed", {
    status: 405,
    headers: corsHeaders(origin),
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (url.pathname === "/api/kv") {
      return handleKvRoute(request, url, origin, env);
    }

    if (request.method !== "GET") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    if (url.pathname === "/") {
      return htmlResponse(getHtml(), 0);
    }

    if (url.pathname === "/app.js") {
      return new Response(getClientScript(), {
        status: 200,
        headers: {
          "Content-Type": "application/javascript; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }

    if (url.pathname === "/api/quote") {
      try {
        const period = normalizePeriod(url.searchParams.get("p"));
        const now = Date.now();

        const memCached = API_MEM_CACHE.get(period);
        if (memCached && now - memCached.at < API_MEM_TTL_MS) {
          return new Response(memCached.body, {
            status: 200,
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              ...corsHeaders(origin),
              "Cache-Control": "public, max-age=2, s-maxage=2",
            },
          });
        }

        const cacheKey = new Request(url.toString(), { method: "GET" });
        const edgeHit = await caches.default.match(cacheKey);

        if (edgeHit) {
          const body = await edgeHit.text();
          API_MEM_CACHE.set(period, { at: now, body });

          return new Response(body, {
            status: 200,
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              ...corsHeaders(origin),
              "Cache-Control": "public, max-age=2, s-maxage=2",
            },
          });
        }

        const payload = await buildQuotePayload(period);
        const body = JSON.stringify(payload, null, 2);

        API_MEM_CACHE.set(period, { at: now, body });

        const response = new Response(body, {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            ...corsHeaders(origin),
            "Cache-Control": "public, max-age=2, s-maxage=2",
          },
        });

        ctx.waitUntil(caches.default.put(cacheKey, response.clone()));
        return response;
      } catch (error) {
        return jsonResponse(
          { ok: false, error: error?.message || String(error) },
          origin,
          502,
          { cacheSeconds: 0 }
        );
      }
    }

    if (url.pathname === "/api/fear-greed") {
      try {
        const now = Date.now();
        const memCached = FEAR_GREED_MEM_CACHE.get("summary");

        if (memCached && now - memCached.at < FEAR_GREED_MEM_TTL_MS) {
          return new Response(memCached.body, {
            status: 200,
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              ...corsHeaders(origin),
              "Cache-Control": `public, max-age=${FEAR_GREED_CACHE_SECONDS}, s-maxage=${FEAR_GREED_CACHE_SECONDS}`,
            },
          });
        }

        const cacheKey = new Request(url.toString(), { method: "GET" });
        const edgeHit = await caches.default.match(cacheKey);

        if (edgeHit) {
          const body = await edgeHit.text();
          FEAR_GREED_MEM_CACHE.set("summary", { at: now, body });

          return new Response(body, {
            status: 200,
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              ...corsHeaders(origin),
              "Cache-Control": `public, max-age=${FEAR_GREED_CACHE_SECONDS}, s-maxage=${FEAR_GREED_CACHE_SECONDS}`,
            },
          });
        }

        const payload = {
          ok: true,
          data: await fetchCnnFearGreedSummary(),
        };
        const body = JSON.stringify(payload, null, 2);

        FEAR_GREED_MEM_CACHE.set("summary", { at: now, body });

        const response = new Response(body, {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            ...corsHeaders(origin),
            "Cache-Control": `public, max-age=${FEAR_GREED_CACHE_SECONDS}, s-maxage=${FEAR_GREED_CACHE_SECONDS}`,
          },
        });

        ctx.waitUntil(caches.default.put(cacheKey, response.clone()));
        return response;
      } catch (error) {
        return jsonResponse(
          { ok: false, error: error?.message || String(error) },
          origin,
          502,
          { cacheSeconds: 0 }
        );
      }
    }

    if (url.pathname === "/api/star-tech") {
      try {
        const period = normalizePeriod(url.searchParams.get("p"));
        const now = Date.now();
        const policy = STAR_TECH_CACHE[period] || STAR_TECH_CACHE.default;
        const memKey = `stars:${period}`;
        const memCached = STAR_TECH_MEM_CACHE.get(memKey);

        if (memCached && now - memCached.at < policy.memTtlMs) {
          return new Response(memCached.body, {
            status: 200,
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              ...corsHeaders(origin),
              "Cache-Control": `public, max-age=${policy.cacheSeconds}, s-maxage=${policy.cacheSeconds}`,
            },
          });
        }

        const cacheKey = new Request(url.toString(), { method: "GET" });
        const edgeHit = await caches.default.match(cacheKey);

        if (edgeHit) {
          const body = await edgeHit.text();
          STAR_TECH_MEM_CACHE.set(memKey, { at: now, body });

          return new Response(body, {
            status: 200,
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              ...corsHeaders(origin),
              "Cache-Control": `public, max-age=${policy.cacheSeconds}, s-maxage=${policy.cacheSeconds}`,
            },
          });
        }

        const payload = await buildStarTechPayload(period, env);
        const body = JSON.stringify(payload, null, 2);

        STAR_TECH_MEM_CACHE.set(memKey, { at: now, body });

        const response = new Response(body, {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            ...corsHeaders(origin),
            "Cache-Control": `public, max-age=${policy.cacheSeconds}, s-maxage=${policy.cacheSeconds}`,
          },
        });

        ctx.waitUntil(caches.default.put(cacheKey, response.clone()));
        return response;
      } catch (error) {
        return jsonResponse(
          { ok: false, error: error?.message || String(error) },
          origin,
          502,
          { cacheSeconds: 0 }
        );
      }
    }

    if (url.pathname === "/api/index-weights") {
      try {
        const indexCode = String(url.searchParams.get("index") || "NDXTMC").toUpperCase();
        const now = Date.now();
        const memKey = `weights:${indexCode}`;
        const memCached = INDEX_WEIGHTS_MEM_CACHE.get(memKey);

        if (memCached && now - memCached.at < INDEX_WEIGHTS_MEM_TTL_MS) {
          return new Response(memCached.body, {
            status: 200,
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              ...corsHeaders(origin),
              "Cache-Control": `public, max-age=${INDEX_WEIGHTS_CACHE_SECONDS}, s-maxage=${INDEX_WEIGHTS_CACHE_SECONDS}`,
            },
          });
        }

        const cacheKey = new Request(url.toString(), { method: "GET" });
        const edgeHit = await caches.default.match(cacheKey);

        if (edgeHit) {
          const body = await edgeHit.text();
          INDEX_WEIGHTS_MEM_CACHE.set(memKey, { at: now, body });

          return new Response(body, {
            status: 200,
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              ...corsHeaders(origin),
              "Cache-Control": `public, max-age=${INDEX_WEIGHTS_CACHE_SECONDS}, s-maxage=${INDEX_WEIGHTS_CACHE_SECONDS}`,
            },
          });
        }

        const payload = await buildIndexWeightsPayload(indexCode, env);
        const body = JSON.stringify(payload, null, 2);

        INDEX_WEIGHTS_MEM_CACHE.set(memKey, { at: now, body });

        const response = new Response(body, {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            ...corsHeaders(origin),
            "Cache-Control": `public, max-age=${INDEX_WEIGHTS_CACHE_SECONDS}, s-maxage=${INDEX_WEIGHTS_CACHE_SECONDS}`,
          },
        });

        ctx.waitUntil(caches.default.put(cacheKey, response.clone()));
        return response;
      } catch (error) {
        return jsonResponse(
          { ok: false, error: error?.message || String(error) },
          origin,
          502,
          { cacheSeconds: 0 }
        );
      }
    }

    if (url.pathname === "/api/search-probe") {
      try {
        const query = String(url.searchParams.get("q") || "NVDA").trim() || "NVDA";
        const sequentialCount = url.searchParams.get("sequential") || "3";
        const parallelCount = url.searchParams.get("parallel") || "3";

        const payload = await probeSeekingAlphaSearch(query, {
          sequentialCount,
          parallelCount,
        });

        return new Response(JSON.stringify(payload, null, 2), {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            ...corsHeaders(origin),
            "Cache-Control": "no-store",
          },
        });
      } catch (error) {
        return jsonResponse(
          { ok: false, error: error?.message || String(error) },
          origin,
          502,
          { cacheSeconds: 0 }
        );
      }
    }

    return new Response("Not Found", { status: 404 });
  },
};
