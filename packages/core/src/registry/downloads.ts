import type { DownloadTrend } from "../types.js";

const NPM_DOWNLOADS_RANGE = "https://api.npmjs.org/downloads/range/last-year";
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 2000;

interface NpmDownloadDay {
  day: string;
  downloads: number;
}

interface NpmDownloadRangeResponse {
  downloads: NpmDownloadDay[];
}

export interface DownloadAnalysis {
  trend: DownloadTrend;
  weeklyDownloads: number;
  monthlyData: Array<{ month: string; downloads: number }>;
}

async function fetchWithRetry(url: string): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "epitaph-dev/0.1 (npm health scoring)" },
      });
      if (res.ok) return res;
      if (attempt < MAX_RETRIES && (res.status === 429 || res.status >= 500)) {
        const retryAfter = parseInt(res.headers.get("retry-after") ?? "", 10);
        const delay =
          !isNaN(retryAfter) && retryAfter > 0
            ? retryAfter * 1000
            : RETRY_BASE_MS * 2 ** attempt;
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      return res;
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_BASE_MS * 2 ** attempt));
        continue;
      }
    }
  }
  throw lastError ?? new Error("fetchWithRetry: all attempts failed");
}

export async function analyzeDownloads(
  packageName: string,
): Promise<DownloadAnalysis> {
  const url = `${NPM_DOWNLOADS_RANGE}/${encodeURIComponent(packageName)}`;
  const res = await fetchWithRetry(url);

  if (!res.ok) {
    return { trend: "stable", weeklyDownloads: 0, monthlyData: [] };
  }

  const data = (await res.json()) as NpmDownloadRangeResponse;
  const days = data.downloads ?? [];

  if (days.length === 0) {
    return { trend: "stable", weeklyDownloads: 0, monthlyData: [] };
  }

  const monthly = aggregateMonthly(days);
  const weeklyDownloads = computeWeeklyAverage(days);
  const trend = computeTrend(monthly);

  return { trend, weeklyDownloads, monthlyData: monthly };
}

function aggregateMonthly(
  days: NpmDownloadDay[],
): Array<{ month: string; downloads: number }> {
  const buckets = new Map<string, number>();

  for (const d of days) {
    const month = d.day.slice(0, 7); // "2025-01"
    buckets.set(month, (buckets.get(month) ?? 0) + d.downloads);
  }

  return Array.from(buckets.entries())
    .map(([month, downloads]) => ({ month, downloads }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

function computeWeeklyAverage(days: NpmDownloadDay[]): number {
  const recentDays = days.slice(-28);
  if (recentDays.length === 0) return 0;
  const total = recentDays.reduce((sum, d) => sum + d.downloads, 0);
  return Math.round((total / recentDays.length) * 7);
}

function computeTrend(
  monthly: Array<{ month: string; downloads: number }>,
): DownloadTrend {
  if (monthly.length < 6) return "stable";

  const recent3 = monthly.slice(-3);
  const previous3 = monthly.slice(-6, -3);

  const recentAvg = average(recent3.map((m) => m.downloads));
  const previousAvg = average(previous3.map((m) => m.downloads));

  if (previousAvg === 0) return recentAvg > 0 ? "growing" : "stable";

  const ratio = recentAvg / previousAvg;

  if (ratio > 1.1) return "growing";
  if (ratio < 0.9) return "declining";
  return "stable";
}

function average(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
