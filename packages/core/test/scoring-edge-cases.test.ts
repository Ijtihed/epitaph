import { describe, it, expect } from "vitest";
import { score } from "../src/scorer/score.js";
import { DEFAULT_WEIGHTS } from "../src/scorer/weights.js";
import type { ScoringInput } from "../src/types.js";

function makeInput(overrides: Partial<ScoringInput> = {}): ScoringInput {
  return {
    archived: false,
    deprecated: false,
    lastCommitDate: new Date(),
    lastHumanCommit: null,
    busFactor: 3,
    avgIssueResponseDays: 7,
    openIssueRatio: 0.15,
    hasFunding: false,
    downloadTrend: "stable",
    weeklyDownloads: 100_000,
    hasOpenSecurityIssues: false,
    ...overrides,
  };
}

describe("null signal redistribution", () => {
  it("null issue response should not penalize score", () => {
    const base = makeInput({ lastCommitDate: new Date(), busFactor: 3 });
    const withData = score({ ...base, avgIssueResponseDays: 7 }, DEFAULT_WEIGHTS);
    const withNull = score({ ...base, avgIssueResponseDays: null }, DEFAULT_WEIGHTS);
    expect(withNull.score).toBeGreaterThanOrEqual(withData.score - 5);
  });

  it("null commit data should not drag score to zero", () => {
    const result = score(
      makeInput({
        lastCommitDate: null,
        lastHumanCommit: null,
        busFactor: 0,
        avgIssueResponseDays: null,
        openIssueRatio: 0.1,
        downloadTrend: "growing",
        weeklyDownloads: 500_000,
      }),
      DEFAULT_WEIGHTS,
    );
    expect(result.score).toBeGreaterThan(20);
  });

  it("package without GitHub repo gets graded on registry data only", () => {
    const result = score(
      {
        archived: false,
        deprecated: false,
        lastHumanCommit: null,
        lastCommitDate: null,
        busFactor: 0,
        avgIssueResponseDays: null,
        openIssueRatio: 0,
        hasFunding: false,
        downloadTrend: "growing",
        weeklyDownloads: 50_000,
        hasOpenSecurityIssues: false,
      },
      DEFAULT_WEIGHTS,
    );
    expect(result.score).toBeGreaterThan(40);
    expect(result.grade).not.toBe("F");
  });

  it("score with all signals available equals score without normalization effect", () => {
    const input = makeInput({
      lastCommitDate: new Date(),
      busFactor: 5,
      avgIssueResponseDays: 3,
      openIssueRatio: 0.1,
      hasFunding: true,
      downloadTrend: "growing",
    });
    const result = score(input, DEFAULT_WEIGHTS);
    expect(result.score).toBe(100);
    expect(result.grade).toBe("A");
  });

  it("all unavailable signals produce score from always-available signals only", () => {
    const result = score(
      makeInput({
        lastCommitDate: null,
        lastHumanCommit: null,
        busFactor: 0,
        avgIssueResponseDays: null,
      }),
      DEFAULT_WEIGHTS,
    );
    expect(result.score).toBeGreaterThan(0);
  });
});

describe("maturity exception", () => {
  it("ms-like package should get at least C", () => {
    const result = score(
      {
        archived: false,
        deprecated: false,
        lastCommitDate: new Date("2020-03-15"),
        lastHumanCommit: new Date("2020-03-15"),
        busFactor: 1,
        avgIssueResponseDays: null,
        openIssueRatio: 0.4,
        hasFunding: false,
        downloadTrend: "stable",
        weeklyDownloads: 180_000_000,
        hasOpenSecurityIssues: false,
      },
      DEFAULT_WEIGHTS,
    );
    expect(["A", "B", "C"]).toContain(result.grade);
  });

  it("triggers for packages with high open issue ratio but massive downloads", () => {
    const result = score(
      makeInput({
        lastCommitDate: new Date("2019-01-01"),
        lastHumanCommit: new Date("2019-01-01"),
        busFactor: 1,
        avgIssueResponseDays: null,
        openIssueRatio: 0.5,
        weeklyDownloads: 50_000_000,
        downloadTrend: "stable",
      }),
      DEFAULT_WEIGHTS,
    );
    expect(result.score).toBeGreaterThanOrEqual(40);
    expect(["A", "B", "C"]).toContain(result.grade);
  });

  it("does not trigger when downloads are declining", () => {
    const result = score(
      makeInput({
        lastCommitDate: new Date("2019-01-01"),
        lastHumanCommit: new Date("2019-01-01"),
        busFactor: 1,
        weeklyDownloads: 50_000_000,
        downloadTrend: "declining",
      }),
      DEFAULT_WEIGHTS,
    );
    expect(result.score).toBeLessThan(40);
  });

  it("does not trigger for low-download packages", () => {
    const result = score(
      makeInput({
        lastCommitDate: new Date("2019-01-01"),
        lastHumanCommit: new Date("2019-01-01"),
        busFactor: 1,
        avgIssueResponseDays: null,
        weeklyDownloads: 500,
        downloadTrend: "stable",
      }),
      DEFAULT_WEIGHTS,
    );
    expect(result.score).toBeLessThan(40);
  });

  it("triggers at 100K+ downloads threshold", () => {
    const result = score(
      makeInput({
        lastCommitDate: new Date("2018-01-01"),
        lastHumanCommit: new Date("2018-01-01"),
        busFactor: 1,
        avgIssueResponseDays: null,
        weeklyDownloads: 150_000,
        downloadTrend: "stable",
      }),
      DEFAULT_WEIGHTS,
    );
    expect(result.score).toBeGreaterThanOrEqual(40);
  });
});

describe("single maintainer scoring", () => {
  it("active single maintainer should get C minimum", () => {
    const result = score(
      {
        archived: false,
        deprecated: false,
        lastHumanCommit: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        lastCommitDate: null,
        busFactor: 1,
        avgIssueResponseDays: 3,
        openIssueRatio: 0.15,
        hasFunding: false,
        downloadTrend: "stable",
        weeklyDownloads: 5_000_000,
        hasOpenSecurityIssues: false,
      },
      DEFAULT_WEIGHTS,
    );
    expect(["A", "B", "C"]).toContain(result.grade);
  });

  it("single maintainer with recent commits scores higher than inactive", () => {
    const active = score(
      makeInput({
        busFactor: 1,
        lastHumanCommit: new Date(),
        avgIssueResponseDays: 5,
      }),
      DEFAULT_WEIGHTS,
    );
    const inactive = score(
      makeInput({
        busFactor: 1,
        lastHumanCommit: new Date("2022-01-01"),
        avgIssueResponseDays: 5,
      }),
      DEFAULT_WEIGHTS,
    );
    expect(active.score).toBeGreaterThan(inactive.score);
  });
});

describe("archived and deprecated fast paths", () => {
  it("archived always returns F regardless of other signals", () => {
    const result = score(
      makeInput({
        archived: true,
        busFactor: 10,
        weeklyDownloads: 100_000_000,
        downloadTrend: "growing",
      }),
      DEFAULT_WEIGHTS,
    );
    expect(result.grade).toBe("F");
    expect(result.score).toBe(0);
  });

  it("deprecated always returns F regardless of other signals", () => {
    const result = score(
      makeInput({
        deprecated: true,
        busFactor: 10,
        weeklyDownloads: 100_000_000,
        downloadTrend: "growing",
      }),
      DEFAULT_WEIGHTS,
    );
    expect(result.grade).toBe("F");
    expect(result.score).toBe(0);
  });
});
