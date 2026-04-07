import { describe, it, expect } from "vitest";
import { analyzeIssues } from "./issues.js";

describe("analyzeIssues", () => {
  it("returns null response times when no issues exist", () => {
    const result = analyzeIssues([], 0, 0);
    expect(result.avgResponseDays).toBeNull();
    expect(result.medianResponseDays).toBeNull();
    expect(result.openIssueRatio).toBe(0);
    expect(result.totalIssues).toBe(0);
  });

  it("returns null response times when no maintainer responses", () => {
    const result = analyzeIssues(
      [
        { createdAt: "2026-03-01T00:00:00Z", firstMaintainerResponseAt: null },
        { createdAt: "2026-03-02T00:00:00Z", firstMaintainerResponseAt: null },
      ],
      5,
      10,
    );
    expect(result.avgResponseDays).toBeNull();
    expect(result.medianResponseDays).toBeNull();
    expect(result.openIssueRatio).toBeCloseTo(5 / 15);
  });

  it("calculates average and median response times", () => {
    const result = analyzeIssues(
      [
        {
          createdAt: "2026-03-01T00:00:00Z",
          firstMaintainerResponseAt: "2026-03-02T00:00:00Z", // 1 day
        },
        {
          createdAt: "2026-03-01T00:00:00Z",
          firstMaintainerResponseAt: "2026-03-04T00:00:00Z", // 3 days
        },
        {
          createdAt: "2026-03-01T00:00:00Z",
          firstMaintainerResponseAt: "2026-03-08T00:00:00Z", // 7 days
        },
      ],
      10,
      40,
    );

    // avg = (1 + 3 + 7) / 3 = 3.67
    expect(result.avgResponseDays).toBeCloseTo(3.7, 1);
    // median of [1, 3, 7] = 3
    expect(result.medianResponseDays).toBe(3);
  });

  it("calculates median for even number of responses", () => {
    const result = analyzeIssues(
      [
        {
          createdAt: "2026-03-01T00:00:00Z",
          firstMaintainerResponseAt: "2026-03-03T00:00:00Z", // 2 days
        },
        {
          createdAt: "2026-03-01T00:00:00Z",
          firstMaintainerResponseAt: "2026-03-05T00:00:00Z", // 4 days
        },
      ],
      5,
      5,
    );

    // median of [2, 4] = 3
    expect(result.medianResponseDays).toBe(3);
  });

  it("calculates open issue ratio correctly", () => {
    const result = analyzeIssues([], 30, 70);
    expect(result.openIssueRatio).toBeCloseTo(0.3);
    expect(result.totalIssues).toBe(100);
    expect(result.openIssues).toBe(30);
  });

  it("handles zero total issues", () => {
    const result = analyzeIssues([], 0, 0);
    expect(result.openIssueRatio).toBe(0);
  });

  it("ignores issues with only non-maintainer responses", () => {
    const result = analyzeIssues(
      [
        {
          createdAt: "2026-03-01T00:00:00Z",
          firstMaintainerResponseAt: "2026-03-02T00:00:00Z", // 1 day
        },
        {
          createdAt: "2026-03-01T00:00:00Z",
          firstMaintainerResponseAt: null, // no maintainer responded
        },
      ],
      10,
      10,
    );

    // Only 1 response counted
    expect(result.avgResponseDays).toBe(1);
    expect(result.medianResponseDays).toBe(1);
  });
});
