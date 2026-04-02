/**
 * HTTP 响应工具
 *
 * 统一管理：
 * - CORS
 * - JSON/HTML 响应头
 * - Cache-Control
 */

function cacheControl(cacheSeconds) {
  return cacheSeconds > 0
    ? `public, max-age=${cacheSeconds}, s-maxage=${cacheSeconds}`
    : "no-store";
}

export function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function jsonResponse(obj, origin, status = 200, { cacheSeconds = 0 } = {}) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(origin),
      "Cache-Control": cacheControl(cacheSeconds),
    },
  });
}

export function htmlResponse(html, cacheSeconds = 60) {
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": cacheControl(cacheSeconds),
    },
  });
}

