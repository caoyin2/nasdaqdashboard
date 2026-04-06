/**
 * Global configuration shared by the Worker and the frontend.
 */

export const UPSTREAM = "https://static.seekingalpha.com/cdn/finance-api/lua_charts";
export const CNN_FG_UPSTREAM = "https://production.dataviz.cnn.io/index/fearandgreed/graphdata";
export const MARKET_TZ = "America/New_York";

export const INDEXES = [
  {
    tickerId: 766533,
    symbol: "SP500-45",
    nameCN: "\u6807\u666e500\u4fe1\u606f\u79d1\u6280\uff08SP500-45\uff09",
    iconSymbol: "SPGI",
  },
  {
    tickerId: 770752,
    symbol: "NDXTMC",
    nameCN: "\u7eb3\u65af\u8fbe\u514b\u79d1\u6280\u5e02\u503c\u52a0\u6743\uff08NDXTMC\uff09",
    iconSymbol: "NDAQ",
  },
  {
    tickerId: 590407,
    symbol: "NDX",
    nameCN: "\u7eb3\u65af\u8fbe\u514b100\uff08NDX\uff09",
    iconSymbol: "NDAQ",
  },
];

export const STAR_TECH_COMPANIES = [
  { symbol: "AAPL", nameCN: "\u82f9\u679c" },
  { symbol: "MSFT", nameCN: "\u5fae\u8f6f" },
  { symbol: "AMZN", nameCN: "\u4e9a\u9a6c\u900a" },
  { symbol: "META", nameCN: "Meta\u5e73\u53f0" },
  { symbol: "GOOGL", nameCN: "\u8c37\u6b4cA" },
  { symbol: "TSLA", nameCN: "\u7279\u65af\u62c9" },
  { symbol: "ORCL", nameCN: "\u7532\u9aa8\u6587" },
  { symbol: "NVDA", nameCN: "\u82f1\u4f1f\u8fbe" },
  { symbol: "AMD", nameCN: "\u8d85\u5a01\u534a\u5bfc\u4f53" },
  { symbol: "TSM", nameCN: "\u53f0\u79ef\u7535" },
  { symbol: "AVGO", nameCN: "\u535a\u901a" },
  { symbol: "INTC", nameCN: "\u82f1\u7279\u5c14" },
  { symbol: "ASML", nameCN: "\u963f\u65af\u9ea6" },
  { symbol: "LRCX", nameCN: "\u6cdb\u6797\u96c6\u56e2" },
  { symbol: "AMAT", nameCN: "\u5e94\u7528\u6750\u6599" },
  { symbol: "KLAC", nameCN: "\u79d1\u78ca" },
  { symbol: "MU", nameCN: "\u7f8e\u5149\u79d1\u6280" },
  { symbol: "PLTR", nameCN: "\u5e15\u5170\u63d0\u5c14" },
];

export const SP500_SECTOR_ETFS = [
  { symbol: "XLC", nameCN: "\u901a\u4fe1\u670d\u52a1" },
  { symbol: "XLY", nameCN: "\u975e\u5fc5\u9700\u6d88\u8d39" },
  { symbol: "XLP", nameCN: "\u5fc5\u9700\u6d88\u8d39" },
  { symbol: "XLE", nameCN: "\u80fd\u6e90" },
  { symbol: "XLF", nameCN: "\u91d1\u878d" },
  { symbol: "XLV", nameCN: "\u533b\u7597\u4fdd\u5065" },
  { symbol: "XLI", nameCN: "\u5de5\u4e1a" },
  { symbol: "XLB", nameCN: "\u539f\u6750\u6599" },
  { symbol: "XLRE", nameCN: "\u623f\u5730\u4ea7" },
  { symbol: "XLK", nameCN: "\u4fe1\u606f\u6280\u672f" },
  { symbol: "XLU", nameCN: "\u516c\u7528\u4e8b\u4e1a" },
];

export const LINE_COLORS = [
  "rgba(0,224,255,.95)",
  "rgba(255,180,0,.95)",
  "rgba(167,139,250,.95)",
];

export const UP_COLOR = "rgba(255,77,109,.95)";
export const DOWN_COLOR = "rgba(34,197,94,.95)";

export const PERIOD_LABELS = {
  "1D": "1\u65e5",
  "5D": "5\u65e5",
  "1M": "1\u6708",
  "6M": "6\u6708",
  "YTD": "\u5e74\u521d\u81f3\u4eca",
  "1Y": "1\u5e74",
};

export const API_MEM_TTL_MS = 3000;

export function normalizePeriod(raw) {
  const p = String(raw || "1D").toUpperCase();
  return p === "5D" || p === "1M" || p === "6M" || p === "YTD" || p === "1Y" ? p : "1D";
}
