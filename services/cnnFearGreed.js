/**
 * CNN 恐惧贪婪指数服务
 *
 * 这里只保留前端真正要用到的摘要字段。
 */

import { CNN_FG_UPSTREAM } from "../config.js";
import { fmtUTC } from "../lib/time.js";

const CNN_TIMEOUT_MS = 12000;
const CNN_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
  "Accept": "application/json,text/plain,*/*",
  "Referer": "https://www.cnn.com/",
  "Origin": "https://www.cnn.com",
};

export function translateFearGreedRating(rating, score) {
  const key = String(rating || "").toLowerCase().trim();

  if (key === "extreme fear") return "极度恐慌";
  if (key === "fear") return "恐慌";
  if (key === "neutral") return "中性";
  if (key === "greed") return "贪婪";
  if (key === "extreme greed") return "极度贪婪";

  if (Number.isFinite(score)) {
    if (score < 25) return "极度恐慌";
    if (score < 45) return "恐慌";
    if (score < 55) return "中性";
    if (score < 75) return "贪婪";
    return "极度贪婪";
  }

  return "暂无数据";
}

export function getFearGreedBucket(score) {
  if (!Number.isFinite(score)) {
    return {
      score: null,
      rating: null,
      ratingCN: "暂无数据",
      bandIndex: null,
    };
  }

  if (score < 25) {
    return {
      score,
      rating: "extreme fear",
      ratingCN: "极度恐慌",
      bandIndex: 0,
    };
  }

  if (score < 45) {
    return {
      score,
      rating: "fear",
      ratingCN: "恐慌",
      bandIndex: 1,
    };
  }

  if (score < 55) {
    return {
      score,
      rating: "neutral",
      ratingCN: "中性",
      bandIndex: 2,
    };
  }

  if (score < 75) {
    return {
      score,
      rating: "greed",
      ratingCN: "贪婪",
      bandIndex: 3,
    };
  }

  return {
    score,
    rating: "extreme greed",
    ratingCN: "极度贪婪",
    bandIndex: 4,
  };
}

export async function fetchCnnFearGreedSummary() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("CNN timeout"), CNN_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(CNN_FG_UPSTREAM, {
      cf: { cacheTtl: 10, cacheEverything: true },
      headers: CNN_HEADERS,
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`CNN fear&greed timeout after ${CNN_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`CNN fear&greed failed: HTTP ${res.status} ${text.slice(0, 120)}`);
  }

  const raw = await res.json();
  const fg = raw?.fear_and_greed;

  const score = +fg?.score;
  const previous1Week = +fg?.previous_1_week;
  const previous1Month = +fg?.previous_1_month;
  const previous1Year = +fg?.previous_1_year;

  const timestamp = typeof fg?.timestamp === "string" ? fg.timestamp : null;
  const timestampMs = timestamp ? Date.parse(timestamp) : NaN;

  const currentBucket = getFearGreedBucket(score);
  const previous1WeekBucket = getFearGreedBucket(previous1Week);
  const previous1MonthBucket = getFearGreedBucket(previous1Month);
  const previous1YearBucket = getFearGreedBucket(previous1Year);

  return {
    score: Number.isFinite(score) ? score : null,
    rating: typeof fg?.rating === "string" ? fg.rating : currentBucket.rating,
    ratingCN: translateFearGreedRating(fg?.rating, score),
    bandIndex: currentBucket.bandIndex,
    timestamp,
    asOfUTC: Number.isFinite(timestampMs) ? fmtUTC(timestampMs) : null,
    previous1Week: previous1WeekBucket,
    previous1Month: previous1MonthBucket,
    previous1Year: previous1YearBucket,
  };
}
