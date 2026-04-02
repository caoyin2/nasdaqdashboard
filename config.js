/**
 * 全局配置文件
 *
 * 这里集中放：
 * - 上游接口地址
 * - 指数列表
 * - 颜色
 * - 周期标签
 * - 统一的 period 规范化函数
 */

export const UPSTREAM = "https://static.seekingalpha.com/cdn/finance-api/lua_charts";
export const CNN_FG_UPSTREAM = "https://production.dataviz.cnn.io/index/fearandgreed/graphdata";
export const MARKET_TZ = "America/New_York";

export const INDEXES = [
  { tickerId: 766533, symbol: "SP500-45", nameCN: "标普500信息科技（SP500-45）" },
  { tickerId: 770752, symbol: "NDXTMC", nameCN: "纳斯达克科技市值加权（NDXTMC）" },
  { tickerId: 590407, symbol: "NDX", nameCN: "纳斯达克100（NDX）" },
];

export const LINE_COLORS = [
  "rgba(0,224,255,.95)",
  "rgba(255,180,0,.95)",
  "rgba(167,139,250,.95)",
];

export const UP_COLOR = "rgba(255,77,109,.95)";
export const DOWN_COLOR = "rgba(34,197,94,.95)";

export const PERIOD_LABELS = {
  "1D": "1日",
  "5D": "5日",
  "1M": "1月",
  "6M": "6月",
  "YTD": "年初至今",
  "1Y": "1年",
};

export const API_MEM_TTL_MS = 3000;

export function normalizePeriod(raw) {
  const p = String(raw || "1D").toUpperCase();
  return p === "5D" || p === "1M" || p === "6M" || p === "YTD" || p === "1Y" ? p : "1D";
}

