import type { CommitAnalysis } from "./commits.js";

export interface BusFactorResult {
  busFactor: number;
  topContributors: Array<{ login: string; commits: number }>;
}

export function calculateBusFactor(analysis: CommitAnalysis): BusFactorResult {
  const entries = Array.from(analysis.authorCommitCounts.entries())
    .map(([login, commits]) => ({ login, commits }))
    .sort((a, b) => b.commits - a.commits);

  const totalCommits = entries.reduce((sum, e) => sum + e.commits, 0);

  if (totalCommits === 0) {
    return { busFactor: 0, topContributors: [] };
  }

  // Bus factor = contributors with > 5% of total commits
  // This weights by commit volume — one person with 500 commits and
  // four people with 1 commit each still yields bus factor ~1.
  const significantContributors = entries.filter(
    (e) => e.commits / totalCommits > 0.05,
  );

  return {
    busFactor: significantContributors.length,
    topContributors: entries.slice(0, 10),
  };
}
