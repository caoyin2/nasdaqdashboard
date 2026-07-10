import { normalizeIndexDataSource } from "../config.js";
import { fetchGoogleFinanceIndexPeriod } from "./googleFinance.js";
import { fetchYahooFinanceIndexPeriod } from "./yahooFinance.js";

export function indexDataSourceLabel(source) {
  return normalizeIndexDataSource(source) === "google" ? "Google Finance" : "Yahoo Finance Taiwan";
}

export async function fetchIndexPeriodBySource(source, period, index) {
  const normalizedSource = normalizeIndexDataSource(source);
  if (normalizedSource === "google") {
    return fetchGoogleFinanceIndexPeriod(period, index);
  }
  return fetchYahooFinanceIndexPeriod(period, index);
}
