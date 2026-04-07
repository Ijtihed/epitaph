import { describe, it, expect } from "vitest";
import { score, gradeFromScore } from "./score.js";
import { PHASE1_WEIGHTS, DEFAULT_WEIGHTS } from "./weights.js";
import type { ScoringInput } from "../types.js";

function makeInput(overrides: Partial<ScoringInput> = {}): ScoringInput {
  return {
    archived: false,
    deprecated: false,
    lastCommitDate: new Date(),
    lastHumanCommit: null,
    busFactor: 0,
    avgIssueResponseDays: null,
    openIssueRatio: 0,
    hasFunding: false,
    downloadTrend: "stable",
    weeklyDownloads: 1000,
    hasOpenSecurityIssues: false,
    ...overrides,
  };
}

describe("gradeFromScore", () => {
  it("assigns A for scores >= 80", () => {
    expect(gradeFromScore(80)).toBe("A");
    expect(gradeFromScore(100)).toBe("A");
    expect(gradeFromScore(95)).toBe("A");
  });

  it("assigns B for scores 60-79", () => {
    expect(gradeFromScore(60)).toBe("B");
    expect(gradeFromScore(79)).toBe("B");
  });

  it("assigns C for scores 40-59", () => {
    expect(gradeFromScore(40)).toBe("C");
    expect(gradeFromScore(59)).toBe("C");
  });

  it("assigns D for scores 20-39", () => {
    expect(gradeFromScore(20)).toBe("D");
    expect(gradeFromScore(39)).toBe("D");
  });

  it("assigns F for scores below 20", () => {
    expect(gradeFromScore(0)).toBe("F");
    expect(gradeFromScore(19)).toBe("F");
  });
});

describe("score", () => {
  it("returns instant F for archived repos", () => {
    const result = score(makeInput({ archived: true }), PHASE1_WEIGHTS);
    expect(result.score).toBe(0);
    expect(result.grade).toBe("F");
    expect(result.signals[0].name).toBe("Archived");
  });

  it("returns instant F for deprecated packages", () => {
    const result = score(makeInput({ deprecated: true }), PHASE1_WEIGHTS);
    expect(result.score).toBe(0);
    expect(result.grade).toBe("F");
    expect(result.signals[0].name).toBe("Deprecated");
  });

  it("gives full score for recent commits (Phase 1 weights)", () => {
    const result = score(
      makeInput({ lastCommitDate: new Date() }),
      PHASE1_WEIGHTS,
    );
    expect(result.score).toBe(100);
    expect(result.grade).toBe("A");
  });

  it("gives reduced score for commits 4 months ago", () => {
    const fourMonthsAgo = new Date();
    fourMonthsAgo.setMonth(fourMonthsAgo.getMonth() - 4);
    const result = score(
      makeInput({ lastCommitDate: fourMonthsAgo }),
      PHASE1_WEIGHTS,
    );
    expect(result.score).toBe(80);
    expect(result.grade).toBe("A");
  });

  it("gives lower score for commits 8 months ago", () => {
    const eightMonthsAgo = new Date();
    eightMonthsAgo.setMonth(eightMonthsAgo.getMonth() - 8);
    const result = score(
      makeInput({ lastCommitDate: eightMonthsAgo }),
      PHASE1_WEIGHTS,
    );
    expect(result.score).toBe(60);
    expect(result.grade).toBe("B");
  });

  it("gives low score for commits 18 months ago", () => {
    const eighteenMonthsAgo = new Date();
    eighteenMonthsAgo.setMonth(eighteenMonthsAgo.getMonth() - 18);
    const result = score(
      makeInput({ lastCommitDate: eighteenMonthsAgo }),
      PHASE1_WEIGHTS,
    );
    expect(result.score).toBe(20);
    expect(result.grade).toBe("D");
  });

  it("gives zero for commits over 2 years ago", () => {
    const threeYearsAgo = new Date();
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
    const result = score(
      makeInput({ lastCommitDate: threeYearsAgo }),
      PHASE1_WEIGHTS,
    );
    expect(result.score).toBe(0);
    expect(result.grade).toBe("F");
  });

  it("applies maturity exception for high-download stable packages", () => {
    const threeYearsAgo = new Date();
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
    const result = score(
      makeInput({
        lastCommitDate: threeYearsAgo,
        weeklyDownloads: 5_000_000,
        openIssueRatio: 0.1,
        downloadTrend: "stable",
      }),
      PHASE1_WEIGHTS,
    );
    expect(result.score).toBeGreaterThanOrEqual(40);
    expect(result.grade).not.toBe("F");
    expect(result.signals.some((s) => s.name === "Stable")).toBe(true);
  });

  it("does not apply maturity exception if downloads declining", () => {
    const threeYearsAgo = new Date();
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
    const result = score(
      makeInput({
        lastCommitDate: threeYearsAgo,
        weeklyDownloads: 5_000_000,
        openIssueRatio: 0.1,
        downloadTrend: "declining",
      }),
      PHASE1_WEIGHTS,
    );
    expect(result.score).toBe(0);
    expect(result.grade).toBe("F");
  });

  it("works with DEFAULT_WEIGHTS (full signal set)", () => {
    const result = score(
      makeInput({
        lastCommitDate: new Date(),
        busFactor: 5,
        avgIssueResponseDays: 3,
        openIssueRatio: 0.1,
        hasFunding: true,
        downloadTrend: "growing",
      }),
      DEFAULT_WEIGHTS,
    );
    expect(result.score).toBe(100);
    expect(result.grade).toBe("A");
  });

  it("prefers human commit date over generic commit date", () => {
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    const result = score(
      makeInput({
        lastCommitDate: twoYearsAgo,
        lastHumanCommit: new Date(),
      }),
      PHASE1_WEIGHTS,
    );
    expect(result.score).toBe(100);
    expect(result.grade).toBe("A");
  });

  it("bus factor 5 scores higher than bus factor 1 with DEFAULT_WEIGHTS", () => {
    const base = {
      lastCommitDate: new Date(),
      avgIssueResponseDays: 3 as number | null,
      openIssueRatio: 0.1,
      hasFunding: true,
      downloadTrend: "growing" as const,
    };
    const highBF = score(makeInput({ ...base, busFactor: 5 }), DEFAULT_WEIGHTS);
    const lowBF = score(makeInput({ ...base, busFactor: 1 }), DEFAULT_WEIGHTS);
    expect(highBF.score).toBeGreaterThan(lowBF.score);
  });

  it("bus factor contributes a signal when using DEFAULT_WEIGHTS", () => {
    const result = score(
      makeInput({ lastCommitDate: new Date(), busFactor: 3 }),
      DEFAULT_WEIGHTS,
    );
    expect(result.signals.some((s) => s.name === "Bus factor")).toBe(true);
  });

  it("bus factor signal not shown when weight is 0", () => {
    const result = score(
      makeInput({ lastCommitDate: new Date(), busFactor: 3 }),
      PHASE1_WEIGHTS,
    );
    expect(result.signals.some((s) => s.name === "Bus factor")).toBe(false);
  });

  it("default weights now produce lower score without bus factor data", () => {
    // With DEFAULT_WEIGHTS, busFactor=0 loses 25 points from that signal
    const result = score(
      makeInput({ lastCommitDate: new Date(), busFactor: 0 }),
      DEFAULT_WEIGHTS,
    );
    expect(result.score).toBeLessThan(100);
    expect(result.score).toBeGreaterThan(0);
  });

  it("human commit date used instead of last push for scoring", () => {
    const longAgo = new Date();
    longAgo.setFullYear(longAgo.getFullYear() - 3);
    const recent = new Date();

    const withHumanCommit = score(
      makeInput({
        lastCommitDate: longAgo,
        lastHumanCommit: recent,
        busFactor: 5,
        avgIssueResponseDays: 3,
        openIssueRatio: 0.1,
        hasFunding: true,
        downloadTrend: "growing",
      }),
      DEFAULT_WEIGHTS,
    );

    const withoutHumanCommit = score(
      makeInput({
        lastCommitDate: longAgo,
        lastHumanCommit: null,
        busFactor: 5,
        avgIssueResponseDays: 3,
        openIssueRatio: 0.1,
        hasFunding: true,
        downloadTrend: "growing",
      }),
      DEFAULT_WEIGHTS,
    );

    expect(withHumanCommit.score).toBeGreaterThan(withoutHumanCommit.score);
  });
});
