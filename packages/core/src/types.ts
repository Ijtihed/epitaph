export type Grade = "A" | "B" | "C" | "D" | "F";

export type Ecosystem = "npm" | "pypi" | "cargo" | "go" | "ruby";

export type DownloadTrend = "growing" | "stable" | "declining";

export interface Dependency {
  name: string;
  version: string;
  isDev: boolean;
  ecosystem: Ecosystem;
}

export interface RepoInfo {
  owner: string;
  repo: string;
  archived: boolean;
  pushedAt: Date;
  openIssuesCount: number;
  stargazersCount: number;
  isFork: boolean;
}

export interface RegistryInfo {
  repoUrl: string | null;
  deprecated: string | null;
  lastPublishDate: Date | null;
  maintainers: Maintainer[];
  weeklyDownloads: number | null;
}

export interface Maintainer {
  name: string;
  email?: string;
}

export interface ScoringInput {
  archived: boolean;
  deprecated: boolean;
  lastCommitDate: Date | null;
  lastHumanCommit: Date | null;
  busFactor: number;
  avgIssueResponseDays: number | null;
  openIssueRatio: number;
  hasFunding: boolean;
  downloadTrend: DownloadTrend;
  weeklyDownloads: number;
  hasOpenSecurityIssues: boolean;
}

export interface Weights {
  lastCommit: number;
  busFactor: number;
  issueResponse: number;
  openIssueRatio: number;
  funding: number;
  downloadTrend: number;
}

export interface Signal {
  name: string;
  value: string;
  emoji: string;
}

export interface DependencyHealth {
  name: string;
  version: string;
  isDev: boolean;
  score: number;
  grade: Grade;
  signals: Signal[];
  repoUrl: string | null;
  deprecated: string | null;
  archived: boolean;
  lastCommitDate: Date | null;
  lastHumanCommit: Date | null;
  busFactor: number;
  topContributors: Array<{ login: string; commits: number }>;
  avgIssueResponseDays: number | null;
  medianIssueResponseDays: number | null;
  openIssueRatio: number;
  hasFunding: boolean;
  fundingPlatforms: string[];
  downloadTrend: DownloadTrend;
  weeklyDownloads: number;
  error: string | null;
}

export interface OwnershipAlert {
  package: string;
  previousVersion: string;
  currentVersion: string;
  previousMaintainers: Maintainer[];
  currentMaintainers: Maintainer[];
}

export interface ForkSuggestion {
  original: string;
  fork: string;
  forkUrl: string;
  commitsSinceAbandoned: number;
}

export interface HealthReport {
  timestamp: Date;
  manifestPath: string;
  ecosystem: Ecosystem;
  dependencies: DependencyHealth[];
  ownershipAlerts: OwnershipAlert[];
  forkSuggestions: ForkSuggestion[];
  summary: {
    total: number;
    dead: number;
    warning: number;
    caution: number;
    healthy: number;
  };
}

export interface EpitaphConfig {
  manifests?: string[];
  ignore?: string[];
  "production-only"?: boolean;
  "fail-grade"?: Grade;
  weights?: Partial<Record<keyof Weights, number>>;
  "cache-ttl"?: number;
  "maturity-threshold"?: number;
}

export interface AnalyzeOptions {
  manifestPath: string;
  token?: string;
  productionOnly?: boolean;
  includeDev?: boolean;
  ignore?: string[];
  weights?: Partial<Weights>;
  config?: EpitaphConfig;
  noCache?: boolean;
  cacheTtlMs?: number;
}
