import { describe, it, expect } from "vitest";
import { calculateBusFactor } from "./contributors.js";
import type { CommitAnalysis } from "./commits.js";

function makeAnalysis(
  authors: Record<string, number>,
): CommitAnalysis {
  return {
    lastHumanCommit: new Date(),
    uniqueHumanAuthors: Object.keys(authors),
    authorCommitCounts: new Map(Object.entries(authors)),
  };
}

describe("calculateBusFactor", () => {
  it("returns 0 for no commits", () => {
    const result = calculateBusFactor({
      lastHumanCommit: null,
      uniqueHumanAuthors: [],
      authorCommitCounts: new Map(),
    });
    expect(result.busFactor).toBe(0);
    expect(result.topContributors).toEqual([]);
  });

  it("returns 1 for a single contributor", () => {
    const result = calculateBusFactor(makeAnalysis({ alice: 50 }));
    expect(result.busFactor).toBe(1);
  });

  it("returns correct bus factor for evenly distributed contributors", () => {
    const result = calculateBusFactor(
      makeAnalysis({ alice: 25, bob: 25, charlie: 25, dave: 25 }),
    );
    expect(result.busFactor).toBe(4);
  });

  it("weights by commit volume — one dominant contributor", () => {
    // alice: 500/504 = 99%, others: 1/504 each ≈ 0.2% (< 5% threshold)
    const result = calculateBusFactor(
      makeAnalysis({ alice: 500, bob: 1, charlie: 1, dave: 1, eve: 1 }),
    );
    expect(result.busFactor).toBe(1);
  });

  it("counts contributors above 5% threshold", () => {
    // alice: 60/100 = 60%, bob: 30/100 = 30%, charlie: 10/100 = 10%
    // all above 5%
    const result = calculateBusFactor(
      makeAnalysis({ alice: 60, bob: 30, charlie: 10 }),
    );
    expect(result.busFactor).toBe(3);
  });

  it("excludes contributors below 5% threshold", () => {
    // alice: 90/100 = 90%, bob: 6/100 = 6%, charlie: 4/100 = 4% (< 5%)
    const result = calculateBusFactor(
      makeAnalysis({ alice: 90, bob: 6, charlie: 4 }),
    );
    expect(result.busFactor).toBe(2);
  });

  it("returns top contributors sorted by commit count", () => {
    const result = calculateBusFactor(
      makeAnalysis({ alice: 10, bob: 50, charlie: 30 }),
    );
    expect(result.topContributors[0].login).toBe("bob");
    expect(result.topContributors[1].login).toBe("charlie");
    expect(result.topContributors[2].login).toBe("alice");
  });
});
