export interface IssueAnalysis {
  avgResponseDays: number | null;
  medianResponseDays: number | null;
  openIssueRatio: number;
  totalIssues: number;
  openIssues: number;
}

export function analyzeIssues(
  recentIssues: Array<{
    createdAt: string;
    firstMaintainerResponseAt: string | null;
  }>,
  openCount: number,
  closedCount: number,
): IssueAnalysis {
  const totalIssues = openCount + closedCount;
  const openIssueRatio = totalIssues > 0 ? openCount / totalIssues : 0;

  const responseTimes: number[] = [];

  for (const issue of recentIssues) {
    if (!issue.firstMaintainerResponseAt) continue;

    const created = new Date(issue.createdAt).getTime();
    const responded = new Date(issue.firstMaintainerResponseAt).getTime();
    const diffDays = (responded - created) / (1000 * 60 * 60 * 24);

    if (diffDays >= 0) {
      responseTimes.push(diffDays);
    }
  }

  if (responseTimes.length === 0) {
    return {
      avgResponseDays: null,
      medianResponseDays: null,
      openIssueRatio,
      totalIssues,
      openIssues: openCount,
    };
  }

  const avg =
    responseTimes.reduce((sum, d) => sum + d, 0) / responseTimes.length;

  const sorted = [...responseTimes].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];

  return {
    avgResponseDays: Math.round(avg * 10) / 10,
    medianResponseDays: Math.round(median * 10) / 10,
    openIssueRatio,
    totalIssues,
    openIssues: openCount,
  };
}
