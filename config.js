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

// Keep the fund premium list in this root config file so Cloudflare Git
// watch-path rules can detect and publish fund-panel behavior changes reliably.
function fundLogoSvg(label, bg, fg) {
  return "data:image/svg+xml;utf8," + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="${bg}"/>
          <stop offset="1" stop-color="#07111f"/>
        </linearGradient>
      </defs>
      <rect width="160" height="160" rx="34" fill="url(#g)"/>
      <circle cx="124" cy="34" r="30" fill="#ffffff" opacity=".14"/>
      <text x="80" y="92" text-anchor="middle" font-family="Microsoft YaHei, PingFang SC, Arial, sans-serif" font-size="48" font-weight="800" fill="${fg}">${label}</text>
    </svg>`
  );
}

export const FUND_PREMIUM_FUNDS = [
  { code: "513100", fallbackName: "\u56fd\u6cf0\u7eb3\u6307ETF", icon: "https://www.gtfund.com/Public/static/etrade/1/dist/i/common/fav.png" },
  { code: "513300", fallbackName: "\u534e\u590f\u7eb3\u65af\u8fbe100ETF", icon: "https://www.chinaamc.com/images/jgindex/logo.png" },
  { code: "159941", fallbackName: "\u5e7f\u53d1\u7eb3\u65af\u8fbe\u514b100ETF", icon: "https://www.gffunds.com.cn/images/2016wx_logo_300.png" },
  { code: "159696", fallbackName: "\u6613\u65b9\u8fbe\u7eb3\u65af\u8fbe\u514b100ETF", icon: "https://www.efunds.com.cn/assets/images/icons/logo_en.png" },
  { code: "513390", fallbackName: "\u535a\u65f6\u7eb3\u65af\u8fbe\u514b100ETF", icon: fundLogoSvg("\u535a\u65f6", "#7a5f3b", "#ffffff") },
  { code: "159660", fallbackName: "\u6c47\u6dfb\u5bcc\u7eb3\u65af\u8fbe\u514b100ETF", icon: "https://www.99fund.com/upload/20160104/201601041451875032384.jpg" },
  { code: "159501", fallbackName: "\u5609\u5b9e\u7eb3\u65af\u8fbe\u514b100ETF", icon: "https://www.jsfund.cn/ws/addimages/logo.svg" },
  { code: "159513", fallbackName: "\u5927\u6210\u7eb3\u65af\u8fbe\u514b100ETF", icon: "https://www.dcfund.com.cn/ws/images/logo_img01.png" },
  { code: "159632", fallbackName: "\u534e\u5b89\u7eb3\u65af\u8fbe\u514bETF", icon: "https://www.huaan.com.cn/img/home_nav_logo.png" },
  { code: "513110", fallbackName: "\u534e\u6cf0\u67cf\u745e\u7eb3\u65af\u8fbe\u514b100ETF", icon: "https://www.huatai-pb.com/assets/logo.png" },
  { code: "513870", fallbackName: "\u5bcc\u56fd\u7eb3\u65af\u8fbe\u514b100ETF", icon: "https://www.fullgoal.com.cn/ws6/asset/logo.png" },
  { code: "159659", fallbackName: "\u62db\u5546\u7eb3\u65af\u8fbe\u514b100ETF", icon: "https://static.cmfchina.com/ws/addimages/logo.png" },
  { code: "161128", fallbackName: "\u6613\u65b9\u8fbe\u6807\u666e\u4fe1\u606f\u79d1\u6280LOF", icon: "https://www.efunds.com.cn/assets/images/icons/logo_en.png" },
  { code: "159509", fallbackName: "\u666f\u987a\u957f\u57ce\u7eb3\u6307\u79d1\u6280", icon: fundLogoSvg("\u666f\u987a", "#09685f", "#ffffff") },
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
  "5Y": "5\u5e74",
  "10Y": "10\u5e74",
  "MAX": "\u6700\u957f",
};

export const API_MEM_TTL_MS = 3000;

export function normalizePeriod(raw) {
  const p = String(raw || "1D").toUpperCase();
  return p === "5D" || p === "1M" || p === "6M" || p === "YTD" || p === "1Y" || p === "5Y" || p === "10Y" || p === "MAX" ? p : "1D";
}
