import { describe, it, expect } from "vitest";
import { analyzeDownloads } from "../src/registry/downloads.js";

/**
 * Live API test — hits the real npm downloads API.
 * Verifies that the download fetching pipeline produces non-zero data
 * for well-known packages. If this fails, the API integration is broken.
 */
describe("analyzeDownloads (live API)", () => {
  it("returns real data for express", async () => {
    const result = await analyzeDownloads("express");
    expect(result.weeklyDownloads).toBeGreaterThan(1_000_000);
    expect(["growing", "stable", "declining"]).toContain(result.trend);
    expect(result.monthlyData.length).toBeGreaterThan(0);
  }, 15_000);

  it("returns real data for escape-html", async () => {
    const result = await analyzeDownloads("escape-html");
    expect(result.weeklyDownloads).toBeGreaterThan(1_000_000);
    expect(result.monthlyData.length).toBeGreaterThan(0);
  }, 15_000);

  it("returns real data for wrappy", async () => {
    const result = await analyzeDownloads("wrappy");
    expect(result.weeklyDownloads).toBeGreaterThan(1_000_000);
    expect(result.monthlyData.length).toBeGreaterThan(0);
  }, 15_000);
});
