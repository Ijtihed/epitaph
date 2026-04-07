import type { Weights } from "../types.js";

export const DEFAULT_WEIGHTS: Weights = {
  lastCommit: 25,
  busFactor: 25,
  issueResponse: 20,
  openIssueRatio: 15,
  funding: 10,
  downloadTrend: 5,
};

export const PHASE1_WEIGHTS: Weights = {
  lastCommit: 100,
  busFactor: 0,
  issueResponse: 0,
  openIssueRatio: 0,
  funding: 0,
  downloadTrend: 0,
};

export function mergeWeights(overrides?: Partial<Weights>): Weights {
  if (!overrides) return DEFAULT_WEIGHTS;
  return { ...DEFAULT_WEIGHTS, ...overrides };
}
