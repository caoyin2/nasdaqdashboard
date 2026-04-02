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
import { buildQuotePayload } from "./services/quoteService.js";
import { getClientScript } from "./ui/client.js";
import { getHtml } from "./ui/html.js";

const API_MEM_CACHE = globalThis.__API_MEM_CACHE__ ?? (globalThis.__API_MEM_CACHE__ = new Map());
const FEAR_GREED_MEM_CACHE =
  globalThis.__FEAR_GREED_MEM_CACHE__ ?? (globalThis.__FEAR_GREED_MEM_CACHE__ = new Map());
const FEAR_GREED_MEM_TTL_MS = 5 * 60 * 1000;
const FEAR_GREED_CACHE_SECONDS = 5 * 60;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
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

    return new Response("Not Found", { status: 404 });
  },
};
