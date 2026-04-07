import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { analyzeDownloads } from "./downloads.js";

describe("analyzeDownloads", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function makeDays(monthlyTotals: number[]): Array<{ day: string; downloads: number }> {
    const days: Array<{ day: string; downloads: number }> = [];
    const now = new Date();
    let monthIndex = monthlyTotals.length;

    for (const total of monthlyTotals) {
      monthIndex--;
      const targetDate = new Date(now);
      targetDate.setMonth(targetDate.getMonth() - monthIndex);
      const year = targetDate.getFullYear();
      const month = String(targetDate.getMonth() + 1).padStart(2, "0");

      const perDay = Math.round(total / 30);
      for (let d = 1; d <= 30; d++) {
        days.push({
          day: `${year}-${month}-${String(d).padStart(2, "0")}`,
          downloads: perDay,
        });
      }
    }
    return days;
  }

  it("detects growing trend", async () => {
    // months: 100K, 100K, 100K, 150K, 150K, 150K (50% increase)
    const days = makeDays([100000, 100000, 100000, 150000, 150000, 150000]);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ downloads: days }),
    });

    const result = await analyzeDownloads("growing-pkg");
    expect(result.trend).toBe("growing");
    expect(result.weeklyDownloads).toBeGreaterThan(0);
  });

  it("detects declining trend", async () => {
    // months: 200K, 200K, 200K, 100K, 100K, 100K (50% decrease)
    const days = makeDays([200000, 200000, 200000, 100000, 100000, 100000]);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ downloads: days }),
    });

    const result = await analyzeDownloads("declining-pkg");
    expect(result.trend).toBe("declining");
  });

  it("detects stable trend", async () => {
    // months: 100K, 100K, 100K, 100K, 100K, 100K
    const days = makeDays([100000, 100000, 100000, 100000, 100000, 100000]);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ downloads: days }),
    });

    const result = await analyzeDownloads("stable-pkg");
    expect(result.trend).toBe("stable");
  });

  it("returns stable for package with zero downloads", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ downloads: [] }),
    });

    const result = await analyzeDownloads("empty-pkg");
    expect(result.trend).toBe("stable");
    expect(result.weeklyDownloads).toBe(0);
    expect(result.monthlyData).toEqual([]);
  });

  it("returns stable when API fails", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404 });

    const result = await analyzeDownloads("nonexistent-pkg");
    expect(result.trend).toBe("stable");
    expect(result.weeklyDownloads).toBe(0);
  });

  it("aggregates days into monthly buckets", async () => {
    const days = makeDays([50000, 60000, 70000, 80000, 90000, 100000]);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ downloads: days }),
    });

    const result = await analyzeDownloads("monthly-pkg");
    expect(result.monthlyData.length).toBeGreaterThanOrEqual(6);
    // Monthly data should be sorted chronologically
    for (let i = 1; i < result.monthlyData.length; i++) {
      expect(result.monthlyData[i].month >= result.monthlyData[i - 1].month).toBe(true);
    }
  });
});
