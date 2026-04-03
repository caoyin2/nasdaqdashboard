/**
 * Global configuration shared by the Worker and the frontend.
 */

export const UPSTREAM = "https://static.seekingalpha.com/cdn/finance-api/lua_charts";
export const CNN_FG_UPSTREAM = "https://production.dataviz.cnn.io/index/fearandgreed/graphdata";
export const MARKET_TZ = "America/New_York";

export const INDEXES = [
  { tickerId: 766533, symbol: "SP500-45", nameCN: "标普500信息科技（SP500-45）" },
  { tickerId: 770752, symbol: "NDXTMC", nameCN: "纳斯达克科技市值加权（NDXTMC）" },
  { tickerId: 590407, symbol: "NDX", nameCN: "纳斯达克100（NDX）" },
];

export const STAR_TECH_COMPANIES = [
  { tickerId: 146, symbol: "AAPL", nameCN: "苹果", icon: "https://static.seekingalpha.com/cdn/s3/company_logos/mark_vector_light/AAPL.svg" },
  { tickerId: 575, symbol: "MSFT", nameCN: "微软", icon: "https://static.seekingalpha.com/cdn/s3/company_logos/mark_vector_light/MSFT.svg" },
  { tickerId: 562, symbol: "AMZN", nameCN: "亚马逊", icon: "https://static.seekingalpha.com/cdn/s3/company_logos/mark_vector_light/AMZN.svg" },
  { tickerId: 36222, symbol: "META", nameCN: "Meta", icon: "https://static.seekingalpha.com/cdn/s3/company_logos/mark_vector_light/META.svg" },
  { tickerId: 148893, symbol: "GOOGL", nameCN: "Alphabet", icon: "https://static.seekingalpha.com/cdn/s3/company_logos/mark_vector_light/GOOGL.svg" },
  { tickerId: 16123, symbol: "TSLA", nameCN: "特斯拉", icon: "https://static.seekingalpha.com/cdn/s3/company_logos/mark_vector_light/TSLA.svg" },
  { tickerId: 663, symbol: "ORCL", nameCN: "甲骨文", icon: "https://static.seekingalpha.com/cdn/s3/company_logos/mark_vector_light/ORCL.svg" },
  { tickerId: 1150, symbol: "NVDA", nameCN: "英伟达", icon: "https://static.seekingalpha.com/cdn/s3/company_logos/mark_vector_light/NVDA.svg" },
  { tickerId: 1016, symbol: "AMD", nameCN: "超威半导体", icon: "https://static.seekingalpha.com/cdn/s3/company_logos/mark_vector_light/AMD.svg" },
  { tickerId: 1534, symbol: "TSM", nameCN: "台积电", icon: "https://static.seekingalpha.com/cdn/s3/company_logos/mark_vector_light/TSM.svg" },
  { tickerId: 14539, symbol: "AVGO", nameCN: "博通", icon: "https://static.seekingalpha.com/cdn/s3/company_logos/mark_vector_light/AVGO.svg" },
  { tickerId: 1017, symbol: "INTC", nameCN: "英特尔", icon: "https://static.seekingalpha.com/cdn/s3/company_logos/mark_vector_light/INTC.svg" },
  { tickerId: 1715, symbol: "ASML", nameCN: "阿斯麦", icon: "https://static.seekingalpha.com/cdn/s3/company_logos/mark_vector_light/ASML.svg" },
  { tickerId: 1181, symbol: "LRCX", nameCN: "泛林集团", icon: "https://static.seekingalpha.com/cdn/s3/company_logos/mark_vector_light/LRCX.svg" },
  { tickerId: 1132, symbol: "AMAT", nameCN: "应用材料", icon: "https://static.seekingalpha.com/cdn/s3/company_logos/mark_vector_light/AMAT.svg" },
  { tickerId: 1793, symbol: "KLAC", nameCN: "科磊", icon: "https://static.seekingalpha.com/cdn/s3/company_logos/mark_vector_light/KLAC.svg" },
  { tickerId: 1309, symbol: "MU", nameCN: "美光科技", icon: "https://static.seekingalpha.com/cdn/s3/company_logos/mark_vector_light/MU.svg" },
  { tickerId: 554416, symbol: "PLTR", nameCN: "帕兰提尔", icon: "https://static.seekingalpha.com/cdn/s3/company_logos/mark_vector_light/PLTR.svg" },
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
