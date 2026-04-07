import type { Grade, ScoringInput, Weights, Signal } from "../types.js";
import { DEFAULT_WEIGHTS } from "./weights.js";

function monthsSince(date: Date): number {
  const now = new Date();
  return (
    (now.getFullYear() - date.getFullYear()) * 12 +
    (now.getMonth() - date.getMonth()) +
    (now.getDate() - date.getDate()) / 30
  );
}

export function gradeFromScore(score: number): Grade {
  if (score >= 80) return "A";
  if (score >= 60) return "B";
  if (score >= 40) return "C";
  if (score >= 20) return "D";
  return "F";
}

function computeWeighted(input: ScoringInput, w: Weights): number {
  const commitDate = input.lastHumanCommit ?? input.lastCommitDate;
  const hasCommitData = commitDate !== null;
  const hasIssueResponseData = input.avgIssueResponseDays !== null;

  let availableWeight = 0;
  let total = 0;

  // Last commit — unavailable when both commit dates are null
  if (hasCommitData && w.lastCommit > 0) {
    availableWeight += w.lastCommit;
    const months = monthsSince(commitDate);
    if (months < 3) total += w.lastCommit;
    else if (months < 6) total += w.lastCommit * 0.8;
    else if (months < 12) total += w.lastCommit * 0.6;
    else if (months < 24) total += w.lastCommit * 0.2;
  }

  // Bus factor — unavailable when we have no commit/repo data
  if (hasCommitData && w.busFactor > 0) {
    availableWeight += w.busFactor;
    if (input.busFactor >= 5) total += w.busFactor;
    else if (input.busFactor >= 3) total += w.busFactor * 0.8;
    else if (input.busFactor >= 2) total += w.busFactor * 0.4;
    else if (input.busFactor >= 1) total += w.busFactor * 0.2;
  }

  // Issue responsiveness — unavailable when avgIssueResponseDays is null
  if (hasIssueResponseData && w.issueResponse > 0) {
    availableWeight += w.issueResponse;
    if (input.avgIssueResponseDays! < 7) total += w.issueResponse;
    else if (input.avgIssueResponseDays! < 14) total += w.issueResponse * 0.75;
    else if (input.avgIssueResponseDays! < 30) total += w.issueResponse * 0.5;
  }

  // Open issue ratio — always available as a numeric value
  if (w.openIssueRatio > 0) {
    availableWeight += w.openIssueRatio;
    if (input.openIssueRatio < 0.2) total += w.openIssueRatio;
    else if (input.openIssueRatio < 0.4) total += w.openIssueRatio * 0.67;
    else if (input.openIssueRatio < 0.6) total += w.openIssueRatio * 0.33;
  }

  // Funding — always available
  if (w.funding > 0) {
    availableWeight += w.funding;
    total += input.hasFunding ? w.funding : w.funding * 0.3;
  }

  // Download trend — always available
  if (w.downloadTrend > 0) {
    availableWeight += w.downloadTrend;
    if (input.downloadTrend === "growing") total += w.downloadTrend;
    else if (input.downloadTrend === "stable") total += w.downloadTrend * 0.6;
    else total += w.downloadTrend * 0.2;
  }

  if (availableWeight === 0) return 0;

  // Normalize: redistribute unavailable signal weights proportionally.
  // Apply coverage dampening (coverage^0.3) so that packages with very few
  // available signals don't get inflated scores from normalization alone.
  // At 100% coverage the factor is 1.0 (no effect); at 30% it's ~0.70.
  const maxWeight =
    w.lastCommit + w.busFactor + w.issueResponse + w.openIssueRatio + w.funding + w.downloadTrend;
  const coverage = availableWeight / maxWeight;
  const dampening = Math.pow(coverage, 0.3);
  return Math.round(((total / availableWeight) * maxWeight) * dampening);
}

export function score(
  input: ScoringInput,
  weights: Weights = DEFAULT_WEIGHTS,
): { score: number; grade: Grade; signals: Signal[] } {
  const signals: Signal[] = [];

  if (input.archived) {
    signals.push({ name: "Archived", value: "Repository is archived", emoji: "⚰️" });
    return { score: 0, grade: "F", signals };
  }

  if (input.deprecated) {
    signals.push({
      name: "Deprecated",
      value: "Package is deprecated on registry",
      emoji: "⚰️",
    });
    return { score: 0, grade: "F", signals };
  }

  // Maturity exception: widely-adopted packages with stable/growing downloads
  // are "done" — not abandoned. The open issue ratio is intentionally excluded
  // here because finished libraries accumulate feature requests that inflate the
  // ratio without reflecting actual neglect.
  const maturityException =
    input.weeklyDownloads > 100_000 &&
    !input.hasOpenSecurityIssues &&
    input.downloadTrend !== "declining";

  const commitDate = input.lastHumanCommit ?? input.lastCommitDate;
  if (commitDate) {
    const months = monthsSince(commitDate);
    if (months < 3) {
      signals.push({ name: "Active", value: "Last commit within 3 months", emoji: "🟢" });
    } else if (months < 6) {
      signals.push({ name: "Recent", value: "Last commit within 6 months", emoji: "🟡" });
    } else if (months < 12) {
      signals.push({
        name: "Aging",
        value: `Last commit ${Math.floor(months)} months ago`,
        emoji: "🟠",
      });
    } else if (months < 24) {
      signals.push({
        name: "Stale",
        value: `Last commit ${Math.floor(months)} months ago`,
        emoji: "🔴",
      });
    } else {
      signals.push({
        name: "Abandoned",
        value: `Last commit ${Math.floor(months)} months ago`,
        emoji: "💀",
      });
    }
  } else {
    signals.push({ name: "Unknown", value: "No commit data available", emoji: "❓" });
  }

  if (input.busFactor > 0 && weights.busFactor > 0) {
    signals.push({
      name: "Bus factor",
      value: `${input.busFactor} contributor${input.busFactor !== 1 ? "s" : ""}`,
      emoji: input.busFactor >= 3 ? "👥" : "👤",
    });
  }

  if (maturityException) {
    signals.push({
      name: "Stable",
      value: `${formatDownloads(input.weeklyDownloads)}/week, widely adopted`,
      emoji: "📦",
    });
  }

  const rawScore = computeWeighted(input, weights);
  const finalScore = maturityException ? Math.max(rawScore, 40) : rawScore;
  const grade = gradeFromScore(finalScore);

  return { score: finalScore, grade, signals };
}

function formatDownloads(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}
