/**
 * Worker 主入口
 *
 * 这个文件只做三件事：
 * 1. 处理路由
 * 2. 处理 /api/quote 的内存缓存与 edge cache
 * 3. 调用真正的业务函数 buildQuotePayload(period)
 */

import { normalizePeriod } from "./config.js";
import { corsHeaders, htmlResponse, jsonResponse } from "./lib/http.js";
import { fetchCnnFearGreedSummary } from "./services/cnnFearGreed.js";
import { buildIndexWeightsPayload } from "./services/indexWeightsService.js";
import { getKvBinding, resolveKvBinding } from "./services/kvBinding.js";
import { buildQuotePayload } from "./services/quoteService.js";
import { probeSeekingAlphaSlugs } from "./services/seekingAlpha.js";
import { getSearchMeta, refreshSearchMeta } from "./services/searchMetaStore.js";
import { buildSp500SectorPayload } from "./services/sp500SectorService.js";
import { addStarTechCompany, getStarTechCompanyList, removeStarTechCompany } from "./services/starTechListStore.js";
import { buildStarTechPayload } from "./services/starTechService.js";
import { getClientScript } from "./ui/client.js";
import { getHtml } from "./ui/html.js";

async function handleKvRoute(request, url, origin, env) {
  const kvInfo = resolveKvBinding(env);
  const kv = kvInfo.binding;
  if (!kv) {
    return jsonResponse(
      {
        ok: false,
        error: "KV binding NasdaqDashboard is not configured on this Worker",
        bindingName: kvInfo.bindingName,
        checkedKeys: kvInfo.checkedKeys.filter((key) => /nasdaq|dashboard/i.test(key)),
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

async function handleSearchMetaRoute(url, origin, env) {
  const symbol = String(url.searchParams.get("symbol") || "").trim().toUpperCase();
  const refresh = url.searchParams.get("refresh") === "1";

  if (!symbol) {
    return jsonResponse({ ok: false, error: "Missing symbol" }, origin, 400, {
      cacheSeconds: 0,
    });
  }

  try {
    const meta = refresh
      ? (await refreshSearchMeta(symbol, env)) || (await getSearchMeta(symbol, env, { allowFetch: false }))
      : await getSearchMeta(symbol, env, { allowFetch: true });

    return jsonResponse(
      {
        ok: true,
        symbol,
        meta,
        kvBound: !!getKvBinding(env),
      },
      origin,
      200,
      { cacheSeconds: 0 }
    );
  } catch (error) {
    return jsonResponse(
      { ok: false, error: error?.message || String(error) },
      origin,
      502,
      { cacheSeconds: 0 }
    );
  }
}

async function handleStarTechListRoute(request, url, origin, env) {
  if (request.method === "GET") {
    try {
      const items = await getStarTechCompanyList(env);
      return jsonResponse({ ok: true, items }, origin, 200, { cacheSeconds: 0 });
    } catch (error) {
      return jsonResponse(
        { ok: false, error: error?.message || String(error) },
        origin,
        502,
        { cacheSeconds: 0 }
      );
    }
  }

  if (request.method === "POST") {
    try {
      const payload = await request.json();
      const items = await addStarTechCompany(env, payload);
      return jsonResponse({ ok: true, items }, origin, 200, { cacheSeconds: 0 });
    } catch (error) {
      return jsonResponse(
        { ok: false, error: error?.message || String(error) },
        origin,
        400,
        { cacheSeconds: 0 }
      );
    }
  }

  if (request.method === "DELETE") {
    try {
      const symbol = String(url.searchParams.get("symbol") || "").trim().toUpperCase();
      const items = await removeStarTechCompany(env, symbol);
      return jsonResponse({ ok: true, items }, origin, 200, { cacheSeconds: 0 });
    } catch (error) {
      return jsonResponse(
        { ok: false, error: error?.message || String(error) },
        origin,
        400,
        { cacheSeconds: 0 }
      );
    }
  }

  return new Response("Method Not Allowed", {
    status: 405,
    headers: corsHeaders(origin),
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (url.pathname === "/api/kv") {
      return handleKvRoute(request, url, origin, env);
    }

    if (url.pathname === "/api/search-meta") {
      return handleSearchMetaRoute(url, origin, env);
    }

    if (url.pathname === "/api/star-tech-list") {
      return handleStarTechListRoute(request, url, origin, env);
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
        const payload = await buildQuotePayload(period, env);
        return jsonResponse(payload, origin, 200, { cacheSeconds: 0 });
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
        const payload = {
          ok: true,
          data: await fetchCnnFearGreedSummary(),
        };
        return jsonResponse(payload, origin, 200, { cacheSeconds: 0 });
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
        const payload = await buildStarTechPayload(period, env);
        return jsonResponse(payload, origin, 200, { cacheSeconds: 0 });
      } catch (error) {
        return jsonResponse(
          { ok: false, error: error?.message || String(error) },
          origin,
          502,
          { cacheSeconds: 0 }
        );
      }
    }

    if (url.pathname === "/api/sp500-sectors") {
      try {
        const period = normalizePeriod(url.searchParams.get("p"));
        const payload = await buildSp500SectorPayload(period, env);
        return jsonResponse(payload, origin, 200, { cacheSeconds: 0 });
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
        const payload = await buildIndexWeightsPayload(indexCode, env);
        return jsonResponse(payload, origin, 200, { cacheSeconds: 0 });
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

        const payload = await probeSeekingAlphaSlugs(query, {
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
