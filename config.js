/**
 * Global configuration shared by the Worker and the frontend.
 */
import { FUND_LOGOS } from "./assets/fundLogos.js";

export const UPSTREAM = "https://static.seekingalpha.com/cdn/finance-api/lua_charts";
export const CNN_FG_UPSTREAM = "https://production.dataviz.cnn.io/index/fearandgreed/graphdata";
export const MARKET_TZ = "America/New_York";

export const INDEX_DATA_SOURCES = {
  yahoo: {
    key: "yahoo",
    label: "雅虎台湾",
    periods: ["1D", "5D", "1M", "6M", "YTD", "1Y", "5Y", "MAX"],
  },
  google: {
    key: "google",
    label: "谷歌财经",
    periods: ["1D", "5D", "1M", "6M", "YTD", "1Y", "5Y", "MAX"],
  },
};

export function normalizeIndexDataSource(raw) {
  return String(raw || "").trim().toLowerCase() === "google" ? "google" : "yahoo";
}

export const INDEXES = [
  {
    tickerId: 766533,
    symbol: "SP500-45",
    googleSymbol: "SP500-45",
    googleExchange: "INDEXSP",
    yahooSymbol: "^SP500-45",
    nameCN: "\u6807\u666e500\u4fe1\u606f\u79d1\u6280\uff08SP500-45\uff09",
    iconSymbol: "SPGI",
  },
  {
    tickerId: 770752,
    symbol: "NDXTMC",
    googleSymbol: "NDXTMC",
    googleExchange: "INDEXNASDAQ",
    yahooSymbol: "^NDXTMC",
    nameCN: "\u7eb3\u65af\u8fbe\u514b\u79d1\u6280\u5e02\u503c\u52a0\u6743\uff08NDXTMC\uff09",
    iconSymbol: "NDAQ",
  },
  {
    tickerId: 590407,
    symbol: "NDX",
    googleSymbol: "NDX",
    googleExchange: "INDEXNASDAQ",
    yahooSymbol: "^NDX",
    nameCN: "\u7eb3\u65af\u8fbe\u514b100\uff08NDX\uff09",
    iconSymbol: "NDAQ",
  },
  {
    tickerId: 587766,
    symbol: "SP500",
    googleSymbol: ".INX",
    googleExchange: "INDEXSP",
    yahooSymbol: "^GSPC",
    nameCN: "\u6807\u666e500\uff08SP500\uff09",
    iconSymbol: "SPGI",
  },
  {
    tickerId: 750108,
    symbol: "MSCIUSA50",
    yahooSymbol: "^750108-USD-STRD",
    dataSources: ["yahoo"],
    nameCN: "MSCI\u7f8e\u56fd50\uff08MSCI USA 50\uff09",
    iconSymbol: "MSCI",
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

// Default seed for the Worker KV fund list. This stays local so first-time
// deployments and a temporarily unavailable KV binding have a safe fallback.
function fundLogo(code) {
  return FUND_LOGOS[code];
}

export const FUND_PREMIUM_FUNDS = [
  { code: "513100", fallbackName: "\u56fd\u6cf0\u7eb3\u6307ETF", icon: fundLogo("513100") },
  { code: "513300", fallbackName: "\u534e\u590f\u7eb3\u65af\u8fbe100ETF", icon: fundLogo("513300") },
  { code: "159941", fallbackName: "\u5e7f\u53d1\u7eb3\u65af\u8fbe\u514b100ETF", icon: fundLogo("159941") },
  { code: "159696", fallbackName: "\u6613\u65b9\u8fbe\u7eb3\u65af\u8fbe\u514b100ETF", icon: fundLogo("159696") },
  { code: "513390", fallbackName: "\u535a\u65f6\u7eb3\u65af\u8fbe\u514b100ETF", icon: fundLogo("513390") },
  { code: "159660", fallbackName: "\u6c47\u6dfb\u5bcc\u7eb3\u65af\u8fbe\u514b100ETF", icon: fundLogo("159660") },
  { code: "159501", fallbackName: "\u5609\u5b9e\u7eb3\u65af\u8fbe\u514b100ETF", icon: fundLogo("159501") },
  { code: "159513", fallbackName: "\u5927\u6210\u7eb3\u65af\u8fbe\u514b100ETF", icon: fundLogo("159513") },
  { code: "159632", fallbackName: "\u534e\u5b89\u7eb3\u65af\u8fbe\u514bETF", icon: fundLogo("159632") },
  { code: "513110", fallbackName: "\u534e\u6cf0\u67cf\u745e\u7eb3\u65af\u8fbe\u514b100ETF", icon: fundLogo("513110") },
  { code: "513870", fallbackName: "\u5bcc\u56fd\u7eb3\u65af\u8fbe\u514b100ETF", icon: fundLogo("513870") },
  { code: "159659", fallbackName: "\u62db\u5546\u7eb3\u65af\u8fbe\u514b100ETF", icon: fundLogo("159659") },
  { code: "161128", fallbackName: "\u6613\u65b9\u8fbe\u6807\u666e\u4fe1\u606f\u79d1\u6280LOF", icon: fundLogo("161128") },
  { code: "159509", fallbackName: "\u666f\u987a\u957f\u57ce\u7eb3\u6307\u79d1\u6280", icon: fundLogo("159509") },
];

// Reusable company-logo choices for funds added from the premium manager.
// The code points at a vetted local asset, never a user-supplied image URL.
export const FUND_LOGO_OPTIONS = [
  { code: "513100", label: "\u56fd\u6cf0\u57fa\u91d1", icon: fundLogo("513100") },
  { code: "513300", label: "\u534e\u590f\u57fa\u91d1", icon: fundLogo("513300") },
  { code: "159941", label: "\u5e7f\u53d1\u57fa\u91d1", icon: fundLogo("159941") },
  { code: "159696", label: "\u6613\u65b9\u8fbe\u57fa\u91d1", icon: fundLogo("159696") },
  { code: "513390", label: "\u535a\u65f6\u57fa\u91d1", icon: fundLogo("513390") },
  { code: "159660", label: "\u6c47\u6dfb\u5bcc\u57fa\u91d1", icon: fundLogo("159660") },
  { code: "159501", label: "\u5609\u5b9e\u57fa\u91d1", icon: fundLogo("159501") },
  { code: "159513", label: "\u5927\u6210\u57fa\u91d1", icon: fundLogo("159513") },
  { code: "159632", label: "\u534e\u5b89\u57fa\u91d1", icon: fundLogo("159632") },
  { code: "513110", label: "\u534e\u6cf0\u67cf\u745e\u57fa\u91d1", icon: fundLogo("513110") },
  { code: "513870", label: "\u5bcc\u56fd\u57fa\u91d1", icon: fundLogo("513870") },
  { code: "159659", label: "\u62db\u5546\u57fa\u91d1", icon: fundLogo("159659") },
  { code: "159509", label: "\u666f\u987a\u957f\u57ce\u57fa\u91d1", icon: fundLogo("159509") },
];

export const LINE_COLORS = [
  "rgba(0,224,255,.95)",
  "rgba(255,180,0,.95)",
  "rgba(167,139,250,.95)",
  "rgba(45,212,191,.95)",
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
  "5Y": "5\u5e74",
  "10Y": "10\u5e74",
  "MAX": "\u6700\u957f",
};

export const API_MEM_TTL_MS = 3000;

export function normalizePeriod(raw) {
  const p = String(raw || "1D").toUpperCase();
  return p === "5D" || p === "1M" || p === "6M" || p === "YTD" || p === "1Y" || p === "5Y" || p === "10Y" || p === "MAX" ? p : "1D";
}
