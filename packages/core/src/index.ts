export { detectManifest, ecosystemFromManifest } from "./manifest/detect.js";
export { parseNpmManifest } from "./manifest/npm.js";
export { fetchNpmRegistryInfo } from "./registry/npm.js";
export { analyzeDownloads } from "./registry/downloads.js";
export { GitHubClient, GitHubNotFoundError, GitHubRateLimitError } from "./github/client.js";
export { fetchRepoInfo, parseGitHubUrl } from "./github/repo-info.js";
export { analyzeCommits } from "./github/commits.js";
export { calculateBusFactor } from "./github/contributors.js";
export { batchFetchRepos } from "./github/graphql.js";
export { analyzeIssues } from "./github/issues.js";
export { analyzeFunding, fetchFundingREST } from "./github/funding.js";
export { score, gradeFromScore } from "./scorer/score.js";
export { DEFAULT_WEIGHTS, PHASE1_WEIGHTS, mergeWeights } from "./scorer/weights.js";
export { isBot, isSourceFile, BOT_PATTERNS, NON_SOURCE_PATHS } from "./bot-list.js";
export { DiskCache, DEFAULT_CACHE_DIR } from "./cache/disk-cache.js";
export * from "./types.js";

import { parseNpmManifest } from "./manifest/npm.js";
import { ecosystemFromManifest } from "./manifest/detect.js";
import { fetchNpmRegistryInfo } from "./registry/npm.js";
import { analyzeDownloads } from "./registry/downloads.js";
import { GitHubClient, GitHubRateLimitError } from "./github/client.js";
import { fetchRepoInfo, parseGitHubUrl } from "./github/repo-info.js";
import { analyzeCommits } from "./github/commits.js";
import { calculateBusFactor } from "./github/contributors.js";
import { batchFetchRepos, type GraphQLRepoData } from "./github/graphql.js";
import { analyzeIssues } from "./github/issues.js";
import { analyzeFunding } from "./github/funding.js";
import { score } from "./scorer/score.js";
import { mergeWeights } from "./scorer/weights.js";
import { DiskCache } from "./cache/disk-cache.js";
import { isBot } from "./bot-list.js";
import type {
  AnalyzeOptions,
  Dependency,
  DependencyHealth,
  DownloadTrend,
  HealthReport,
  RegistryInfo,
  ScoringInput,
  Weights,
} from "./types.js";
import type { CommitAnalysis } from "./github/commits.js";
import type { DownloadAnalysis } from "./registry/downloads.js";

const CONCURRENCY = 10;
const DOWNLOAD_CONCURRENCY = 5;
let tokenTipShown = false;

async function processInBatches<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

function shouldIgnore(name: string, ignorePatterns: string[]): boolean {
  return ignorePatterns.some((pattern) => {
    if (pattern.endsWith("/*")) {
      const prefix = pattern.slice(0, -2);
      return name.startsWith(prefix + "/") || name === prefix;
    }
    if (pattern.includes("*")) {
      const regex = new RegExp(
        "^" + pattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$",
      );
      return regex.test(name);
    }
    return name === pattern;
  });
}

// --- Cached data shapes ---

interface CachedRegistryData {
  repoUrl: string | null;
  deprecated: string | null;
  lastPublishDate: string | null;
  maintainers: Array<{ name: string; email?: string }>;
  weeklyDownloads: number | null;
}

interface CachedGitHubData {
  archived: boolean;
  pushedAt: string;
  openIssuesCount: number;
  closedIssuesCount: number;
  stargazersCount: number;
  isFork: boolean;
  lastHumanCommit: string | null;
  uniqueHumanAuthors: string[];
  authorCommitCounts: Record<string, number>;
  avgIssueResponseDays: number | null;
  medianIssueResponseDays: number | null;
  openIssueRatio: number;
  hasFunding: boolean;
  fundingPlatforms: string[];
}

interface CachedDownloadData {
  trend: DownloadTrend;
  weeklyDownloads: number;
  monthlyData: Array<{ month: string; downloads: number }>;
}

// --- GraphQL commit analysis (bot filtering only, no file-path check) ---

function analyzeCommitsFromGraphQL(
  commits: GraphQLRepoData["recentCommits"],
): CommitAnalysis {
  const authorCounts = new Map<string, number>();
  let lastHumanCommit: Date | null = null;

  for (const c of commits) {
    const login = c.authorLogin;
    if (!login) continue;
    if (isBot(login)) continue;

    authorCounts.set(login, (authorCounts.get(login) ?? 0) + 1);

    if (!lastHumanCommit) {
      lastHumanCommit = new Date(c.committedDate);
    }
  }

  return {
    lastHumanCommit,
    uniqueHumanAuthors: Array.from(authorCounts.keys()),
    authorCommitCounts: authorCounts,
  };
}

// --- Per-dep analysis result (internal) ---

interface DepAnalysisData {
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
}

function buildHealth(
  dep: Dependency,
  registry: RegistryInfo,
  gh: DepAnalysisData,
  weights: Weights,
): DependencyHealth {
  const input: ScoringInput = {
    archived: gh.archived,
    deprecated: registry.deprecated !== null,
    lastCommitDate: gh.lastCommitDate,
    lastHumanCommit: gh.lastHumanCommit,
    busFactor: gh.busFactor,
    avgIssueResponseDays: gh.avgIssueResponseDays,
    openIssueRatio: gh.openIssueRatio,
    hasFunding: gh.hasFunding,
    downloadTrend: gh.downloadTrend,
    weeklyDownloads: gh.weeklyDownloads,
    hasOpenSecurityIssues: false,
  };

  const result = score(input, weights);

  return {
    name: dep.name,
    version: dep.version,
    isDev: dep.isDev,
    score: result.score,
    grade: result.grade,
    signals: result.signals,
    repoUrl: registry.repoUrl,
    deprecated: registry.deprecated,
    archived: gh.archived,
    lastCommitDate: gh.lastCommitDate,
    lastHumanCommit: gh.lastHumanCommit,
    busFactor: gh.busFactor,
    topContributors: gh.topContributors,
    avgIssueResponseDays: gh.avgIssueResponseDays,
    medianIssueResponseDays: gh.medianIssueResponseDays,
    openIssueRatio: gh.openIssueRatio,
    hasFunding: gh.hasFunding,
    fundingPlatforms: gh.fundingPlatforms,
    downloadTrend: gh.downloadTrend,
    weeklyDownloads: gh.weeklyDownloads,
    error: null,
  };
}

function makeErrorHealth(dep: Dependency, err: unknown): DependencyHealth {
  return {
    name: dep.name,
    version: dep.version,
    isDev: dep.isDev,
    score: -1,
    grade: "F",
    signals: [{ name: "Error", value: String(err), emoji: "❌" }],
    repoUrl: null,
    deprecated: null,
    archived: false,
    lastCommitDate: null,
    lastHumanCommit: null,
    busFactor: 0,
    topContributors: [],
    avgIssueResponseDays: null,
    medianIssueResponseDays: null,
    openIssueRatio: 0,
    hasFunding: false,
    fundingPlatforms: [],
    downloadTrend: "stable",
    weeklyDownloads: 0,
    error: err instanceof Error ? err.message : String(err),
  };
}

// --- Registry + download fetching ---

async function fetchRegistryData(
  dep: Dependency,
  cache: DiskCache | null,
): Promise<RegistryInfo> {
  const cacheKey = `registry/npm/${dep.name}`;
  const cached = cache ? await cache.get<CachedRegistryData>(cacheKey) : null;
  if (cached) {
    return {
      ...cached,
      lastPublishDate: cached.lastPublishDate ? new Date(cached.lastPublishDate) : null,
    };
  }

  const info = await fetchNpmRegistryInfo(dep.name);
  if (cache) {
    await cache.set<CachedRegistryData>(cacheKey, {
      ...info,
      lastPublishDate: info.lastPublishDate?.toISOString() ?? null,
    });
  }
  return info;
}

async function fetchDownloadData(
  dep: Dependency,
  cache: DiskCache | null,
): Promise<DownloadAnalysis> {
  const cacheKey = `downloads/${dep.name}`;
  const cached = cache ? await cache.get<CachedDownloadData>(cacheKey) : null;
  if (cached) return cached;

  try {
    const analysis = await analyzeDownloads(dep.name);
    if (cache) {
      await cache.set<CachedDownloadData>(cacheKey, analysis);
    }
    return analysis;
  } catch {
    return { trend: "stable", weeklyDownloads: 0, monthlyData: [] };
  }
}

// --- REST-path per dependency (no-token or GraphQL fallback) ---

async function analyzeDepREST(
  dep: Dependency,
  registry: RegistryInfo,
  downloads: DownloadAnalysis,
  github: GitHubClient,
  cache: DiskCache | null,
  weights: Weights,
): Promise<DependencyHealth> {
  let archived = false;
  let lastCommitDate: Date | null = null;
  let lastHumanCommit: Date | null = null;
  let busFactor = 0;
  let topContributors: Array<{ login: string; commits: number }> = [];

  if (registry.repoUrl) {
    const parsed = parseGitHubUrl(registry.repoUrl);
    if (parsed) {
      const ghCacheKey = `github/${parsed.owner}/${parsed.repo}`;
      const cachedGH = cache ? await cache.get<CachedGitHubData>(ghCacheKey) : null;

      if (cachedGH) {
        archived = cachedGH.archived;
        lastCommitDate = new Date(cachedGH.pushedAt);
        lastHumanCommit = cachedGH.lastHumanCommit ? new Date(cachedGH.lastHumanCommit) : null;

        const countsMap = new Map(Object.entries(cachedGH.authorCommitCounts));
        const bf = calculateBusFactor({
          lastHumanCommit,
          uniqueHumanAuthors: cachedGH.uniqueHumanAuthors,
          authorCommitCounts: countsMap,
        });
        busFactor = bf.busFactor;
        topContributors = bf.topContributors;

        return buildHealth(dep, registry, {
          archived,
          lastCommitDate,
          lastHumanCommit,
          busFactor,
          topContributors,
          avgIssueResponseDays: cachedGH.avgIssueResponseDays,
          medianIssueResponseDays: cachedGH.medianIssueResponseDays,
          openIssueRatio: cachedGH.openIssueRatio,
          hasFunding: cachedGH.hasFunding,
          fundingPlatforms: cachedGH.fundingPlatforms,
          downloadTrend: downloads.trend,
          weeklyDownloads: downloads.weeklyDownloads,
        }, weights);
      }

      try {
        const repo = await fetchRepoInfo(github, parsed.owner, parsed.repo);
        archived = repo.archived;
        lastCommitDate = repo.pushedAt;

        let commitAnalysis: CommitAnalysis = {
          lastHumanCommit: null,
          uniqueHumanAuthors: [],
          authorCommitCounts: new Map(),
        };

        if (!archived) {
          try {
            commitAnalysis = await analyzeCommits(github, parsed.owner, parsed.repo);
            lastHumanCommit = commitAnalysis.lastHumanCommit;
          } catch {
            // best-effort
          }
        }

        const bf = calculateBusFactor(commitAnalysis);
        busFactor = bf.busFactor;
        topContributors = bf.topContributors;

        if (cache) {
          await cache.set<CachedGitHubData>(ghCacheKey, {
            archived: repo.archived,
            pushedAt: repo.pushedAt.toISOString(),
            openIssuesCount: repo.openIssuesCount,
            closedIssuesCount: 0,
            stargazersCount: repo.stargazersCount,
            isFork: repo.isFork,
            lastHumanCommit: commitAnalysis.lastHumanCommit?.toISOString() ?? null,
            uniqueHumanAuthors: commitAnalysis.uniqueHumanAuthors,
            authorCommitCounts: Object.fromEntries(commitAnalysis.authorCommitCounts),
            avgIssueResponseDays: null,
            medianIssueResponseDays: null,
            openIssueRatio: 0,
            hasFunding: false,
            fundingPlatforms: [],
          });
        }
      } catch (err) {
        if (err instanceof GitHubRateLimitError) throw err;
      }
    }
  }

  return buildHealth(dep, registry, {
    archived,
    lastCommitDate,
    lastHumanCommit,
    busFactor,
    topContributors,
    avgIssueResponseDays: null,
    medianIssueResponseDays: null,
    openIssueRatio: 0,
    hasFunding: false,
    fundingPlatforms: [],
    downloadTrend: downloads.trend,
    weeklyDownloads: downloads.weeklyDownloads,
  }, weights);
}

// --- Main orchestrator ---

export async function analyzeHealth(
  options: AnalyzeOptions & { onProgress?: (name: string) => void },
): Promise<HealthReport> {
  const ecosystem = ecosystemFromManifest(options.manifestPath);

  let deps: Dependency[];
  switch (ecosystem) {
    case "npm":
      deps = await parseNpmManifest(
        options.manifestPath,
        options.productionOnly,
      );
      break;
    default:
      throw new Error(`Ecosystem "${ecosystem}" is not yet supported.`);
  }

  const ignore = options.ignore ?? [];
  deps = deps.filter((d) => !shouldIgnore(d.name, ignore));

  const token = options.token;
  const weights = mergeWeights(options.weights);
  const cache = options.noCache ? null : new DiskCache(undefined, options.cacheTtlMs);
  const github = new GitHubClient({ token });

  if (!token && !tokenTipShown) {
    tokenTipShown = true;
    options.onProgress?.("Tip: set GITHUB_TOKEN for faster scans and deeper analysis");
  }

  // 1. Fetch registry data for all deps (parallel, no auth)
  const registryMap = new Map<string, RegistryInfo>();
  await processInBatches(deps, CONCURRENCY, async (dep) => {
    options.onProgress?.(dep.name);
    try {
      registryMap.set(dep.name, await fetchRegistryData(dep, cache));
    } catch {
      // registry fetch failed — will produce error health later
    }
  });

  // 2. Fetch download data for all deps (parallel, no auth).
  // Lower concurrency to avoid npm API rate limits (Cloudflare 429s).
  const downloadMap = new Map<string, DownloadAnalysis>();
  await processInBatches(deps, DOWNLOAD_CONCURRENCY, async (dep) => {
    downloadMap.set(dep.name, await fetchDownloadData(dep, cache));
  });

  // 3. GitHub data — GraphQL batch if token available, REST fallback otherwise
  const results: DependencyHealth[] = [];

  if (token) {
    // Collect repos to query via GraphQL
    const repoToDeps = new Map<string, { owner: string; repo: string; deps: Dependency[] }>();

    for (const dep of deps) {
      const registry = registryMap.get(dep.name);
      if (!registry?.repoUrl) continue;
      const parsed = parseGitHubUrl(registry.repoUrl);
      if (!parsed) continue;

      const key = `${parsed.owner}/${parsed.repo}`;
      const existing = repoToDeps.get(key);
      if (existing) {
        existing.deps.push(dep);
      } else {
        repoToDeps.set(key, { ...parsed, deps: [dep] });
      }
    }

    // Check cache first, partition into cached vs uncached
    const cachedGHMap = new Map<string, CachedGitHubData>();
    const uncachedRepos: Array<{ owner: string; repo: string }> = [];

    for (const [key, entry] of repoToDeps) {
      const ghCacheKey = `github/${key}`;
      const cachedGH = cache ? await cache.get<CachedGitHubData>(ghCacheKey) : null;
      if (cachedGH) {
        cachedGHMap.set(key, cachedGH);
      } else {
        uncachedRepos.push({ owner: entry.owner, repo: entry.repo });
      }
    }

    // Batch-fetch uncached repos via GraphQL
    let graphQLResults = new Map<string, GraphQLRepoData>();
    if (uncachedRepos.length > 0) {
      try {
        graphQLResults = await batchFetchRepos(token, uncachedRepos);
      } catch {
        // GraphQL failed — will fall back to REST per-dep below
      }
    }

    // Process each dep
    for (const dep of deps) {
      const registry = registryMap.get(dep.name);
      if (!registry) {
        results.push(makeErrorHealth(dep, `npm registry lookup failed for ${dep.name}`));
        continue;
      }

      const downloads = downloadMap.get(dep.name) ?? { trend: "stable" as const, weeklyDownloads: 0, monthlyData: [] };

      if (!registry.repoUrl) {
        results.push(buildHealth(dep, registry, {
          archived: false,
          lastCommitDate: null,
          lastHumanCommit: null,
          busFactor: 0,
          topContributors: [],
          avgIssueResponseDays: null,
          medianIssueResponseDays: null,
          openIssueRatio: 0,
          hasFunding: false,
          fundingPlatforms: [],
          downloadTrend: downloads.trend,
          weeklyDownloads: downloads.weeklyDownloads,
        }, weights));
        continue;
      }

      const parsed = parseGitHubUrl(registry.repoUrl);
      if (!parsed) {
        results.push(buildHealth(dep, registry, {
          archived: false,
          lastCommitDate: null,
          lastHumanCommit: null,
          busFactor: 0,
          topContributors: [],
          avgIssueResponseDays: null,
          medianIssueResponseDays: null,
          openIssueRatio: 0,
          hasFunding: false,
          fundingPlatforms: [],
          downloadTrend: downloads.trend,
          weeklyDownloads: downloads.weeklyDownloads,
        }, weights));
        continue;
      }

      const repoKey = `${parsed.owner}/${parsed.repo}`;

      // Try cache
      const cachedGH = cachedGHMap.get(repoKey);
      if (cachedGH) {
        const countsMap = new Map(Object.entries(cachedGH.authorCommitCounts));
        const bf = calculateBusFactor({
          lastHumanCommit: cachedGH.lastHumanCommit ? new Date(cachedGH.lastHumanCommit) : null,
          uniqueHumanAuthors: cachedGH.uniqueHumanAuthors,
          authorCommitCounts: countsMap,
        });

        results.push(buildHealth(dep, registry, {
          archived: cachedGH.archived,
          lastCommitDate: new Date(cachedGH.pushedAt),
          lastHumanCommit: cachedGH.lastHumanCommit ? new Date(cachedGH.lastHumanCommit) : null,
          busFactor: bf.busFactor,
          topContributors: bf.topContributors,
          avgIssueResponseDays: cachedGH.avgIssueResponseDays,
          medianIssueResponseDays: cachedGH.medianIssueResponseDays,
          openIssueRatio: cachedGH.openIssueRatio,
          hasFunding: cachedGH.hasFunding,
          fundingPlatforms: cachedGH.fundingPlatforms,
          downloadTrend: downloads.trend,
          weeklyDownloads: downloads.weeklyDownloads,
        }, weights));
        continue;
      }

      // Try GraphQL result
      const gqlData = graphQLResults.get(repoKey);
      if (gqlData) {
        const commitAnalysis = analyzeCommitsFromGraphQL(gqlData.recentCommits);
        const bf = calculateBusFactor(commitAnalysis);
        const issueData = analyzeIssues(
          gqlData.recentIssues,
          gqlData.openIssueCount,
          gqlData.closedIssueCount,
        );
        const fundingData = analyzeFunding(gqlData.fundingLinks);

        const ghCacheKey = `github/${repoKey}`;
        if (cache) {
          await cache.set<CachedGitHubData>(ghCacheKey, {
            archived: gqlData.isArchived,
            pushedAt: gqlData.pushedAt,
            openIssuesCount: gqlData.openIssueCount,
            closedIssuesCount: gqlData.closedIssueCount,
            stargazersCount: gqlData.stargazerCount,
            isFork: false,
            lastHumanCommit: commitAnalysis.lastHumanCommit?.toISOString() ?? null,
            uniqueHumanAuthors: commitAnalysis.uniqueHumanAuthors,
            authorCommitCounts: Object.fromEntries(commitAnalysis.authorCommitCounts),
            avgIssueResponseDays: issueData.avgResponseDays,
            medianIssueResponseDays: issueData.medianResponseDays,
            openIssueRatio: issueData.openIssueRatio,
            hasFunding: fundingData.hasFunding,
            fundingPlatforms: fundingData.platforms,
          });
        }

        results.push(buildHealth(dep, registry, {
          archived: gqlData.isArchived,
          lastCommitDate: new Date(gqlData.pushedAt),
          lastHumanCommit: commitAnalysis.lastHumanCommit,
          busFactor: bf.busFactor,
          topContributors: bf.topContributors,
          avgIssueResponseDays: issueData.avgResponseDays,
          medianIssueResponseDays: issueData.medianResponseDays,
          openIssueRatio: issueData.openIssueRatio,
          hasFunding: fundingData.hasFunding,
          fundingPlatforms: fundingData.platforms,
          downloadTrend: downloads.trend,
          weeklyDownloads: downloads.weeklyDownloads,
        }, weights));
        continue;
      }

      // Fallback to REST for this dep (GraphQL missed it, e.g. private repo)
      try {
        results.push(
          await analyzeDepREST(dep, registry, downloads, github, cache, weights),
        );
      } catch (err) {
        if (err instanceof GitHubRateLimitError) throw err;
        results.push(makeErrorHealth(dep, err));
      }
    }
  } else {
    // No token — pure REST path
    for (const dep of deps) {
      const registry = registryMap.get(dep.name);
      if (!registry) {
        results.push(makeErrorHealth(dep, `npm registry lookup failed for ${dep.name}`));
        continue;
      }
      const downloads = downloadMap.get(dep.name) ?? { trend: "stable" as const, weeklyDownloads: 0, monthlyData: [] };

      try {
        options.onProgress?.(dep.name);
        results.push(
          await analyzeDepREST(dep, registry, downloads, github, cache, weights),
        );
      } catch (err) {
        if (err instanceof GitHubRateLimitError) throw err;
        results.push(makeErrorHealth(dep, err));
      }
    }
  }

  results.sort((a, b) => a.score - b.score);

  const dead = results.filter((d) => d.grade === "F" && d.error === null).length;
  const warning = results.filter((d) => d.grade === "D").length;
  const caution = results.filter((d) => d.grade === "C").length;
  const healthy = results.filter((d) => d.grade === "A" || d.grade === "B").length;

  return {
    timestamp: new Date(),
    manifestPath: options.manifestPath,
    ecosystem,
    dependencies: results,
    ownershipAlerts: [],
    forkSuggestions: [],
    summary: {
      total: results.length,
      dead,
      warning,
      caution,
      healthy,
    },
  };
}
