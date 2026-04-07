import chalk from "chalk";
import ora from "ora";
import {
  fetchNpmRegistryInfo,
  GitHubClient,
  fetchRepoInfo,
  parseGitHubUrl,
  analyzeCommits,
  calculateBusFactor,
  analyzeDownloads,
  analyzeIssues,
  analyzeFunding,
  fetchFundingREST,
  batchFetchRepos,
  isBot,
  score,
  DEFAULT_WEIGHTS,
  type RepoInfo,
  type RegistryInfo,
  type ScoringInput,
  type DownloadTrend,
} from "@epitaph-dev/core";

export interface ExplainOptions {
  token?: string;
}

function timeAgo(date: Date): string {
  const ms = Date.now() - date.getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days < 1) return "today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return "1 month ago";
  if (months < 12) return `${months} months ago`;
  const years = Math.floor(months / 12);
  if (years === 1) return "1 year ago";
  return `${years} years ago`;
}

const TREND_ARROWS: Record<DownloadTrend, string> = {
  growing: "↑",
  stable: "→",
  declining: "↓",
};

function formatDownloads(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

export async function explain(
  packageName: string,
  options: ExplainOptions,
): Promise<void> {
  const spinner = ora(`Fetching data for ${chalk.cyan(packageName)}...`).start();

  let registryInfo: RegistryInfo;
  try {
    registryInfo = await fetchNpmRegistryInfo(packageName);
  } catch (err) {
    spinner.fail(`Could not fetch registry data: ${err}`);
    process.exit(2);
  }

  // Download trend (no auth needed, parallel-safe)
  spinner.text = `Fetching download data for ${chalk.cyan(packageName)}...`;
  let downloadTrend: DownloadTrend = "stable";
  let weeklyDl = registryInfo.weeklyDownloads ?? 0;
  try {
    const dl = await analyzeDownloads(packageName);
    downloadTrend = dl.trend;
    weeklyDl = dl.weeklyDownloads;
  } catch {
    // best-effort
  }

  let repoInfo: RepoInfo | null = null;
  let lastHumanCommit: Date | null = null;
  let busFactor = 0;
  let topContributors: Array<{ login: string; commits: number }> = [];
  let avgIssueResponseDays: number | null = null;
  let medianIssueResponseDays: number | null = null;
  let openIssueRatio = 0;
  let hasFunding = false;
  let fundingPlatforms: string[] = [];

  const token = options.token ?? process.env.GITHUB_TOKEN ?? process.env.EPITAPH_GITHUB_TOKEN;

  if (registryInfo.repoUrl) {
    const parsed = parseGitHubUrl(registryInfo.repoUrl);
    if (parsed) {
      // Try GraphQL first (gets everything in one call)
      if (token) {
        spinner.text = `Fetching repo data via GraphQL for ${chalk.cyan(parsed.owner + "/" + parsed.repo)}...`;
        try {
          const gqlResults = await batchFetchRepos(token, [{ owner: parsed.owner, repo: parsed.repo }]);
          const gqlData = gqlResults.get(`${parsed.owner}/${parsed.repo}`);
          if (gqlData) {
            repoInfo = {
              owner: parsed.owner,
              repo: parsed.repo,
              archived: gqlData.isArchived,
              pushedAt: new Date(gqlData.pushedAt),
              openIssuesCount: gqlData.openIssueCount,
              stargazersCount: gqlData.stargazerCount,
              isFork: false,
            };

            // Commits + bus factor
            const commits = gqlData.recentCommits;
            const authorCounts = new Map<string, number>();
            for (const c of commits) {
              const login = c.authorLogin;
              if (!login) continue;
              if (isBot(login)) continue;
              authorCounts.set(login, (authorCounts.get(login) ?? 0) + 1);
              if (!lastHumanCommit) lastHumanCommit = new Date(c.committedDate);
            }
            const bf = calculateBusFactor({
              lastHumanCommit,
              uniqueHumanAuthors: Array.from(authorCounts.keys()),
              authorCommitCounts: authorCounts,
            });
            busFactor = bf.busFactor;
            topContributors = bf.topContributors;

            // Issues
            const issues = analyzeIssues(gqlData.recentIssues, gqlData.openIssueCount, gqlData.closedIssueCount);
            avgIssueResponseDays = issues.avgResponseDays;
            medianIssueResponseDays = issues.medianResponseDays;
            openIssueRatio = issues.openIssueRatio;

            // Funding
            const funding = analyzeFunding(gqlData.fundingLinks);
            hasFunding = funding.hasFunding;
            fundingPlatforms = funding.platforms;
          }
        } catch {
          // Fall through to REST
        }
      }

      // REST fallback if GraphQL didn't work
      if (!repoInfo) {
        const github = new GitHubClient({ token });
        try {
          spinner.text = `Fetching repo info for ${chalk.cyan(parsed.owner + "/" + parsed.repo)}...`;
          repoInfo = await fetchRepoInfo(github, parsed.owner, parsed.repo);

          if (!repoInfo.archived) {
            spinner.text = `Analyzing commits...`;
            try {
              const commitAnalysis = await analyzeCommits(github, parsed.owner, parsed.repo);
              lastHumanCommit = commitAnalysis.lastHumanCommit;
              const bf = calculateBusFactor(commitAnalysis);
              busFactor = bf.busFactor;
              topContributors = bf.topContributors;
            } catch {
              // best-effort
            }

            if (token) {
              try {
                const funding = await fetchFundingREST(github, parsed.owner, parsed.repo);
                hasFunding = funding.hasFunding;
                fundingPlatforms = funding.platforms;
              } catch {
                // best-effort
              }
            }
          }
        } catch {
          // continue without repo info
        }
      }
    }
  }

  spinner.stop();

  // Compute score
  const input: ScoringInput = {
    archived: repoInfo?.archived ?? false,
    deprecated: registryInfo.deprecated !== null,
    lastCommitDate: repoInfo?.pushedAt ?? null,
    lastHumanCommit,
    busFactor,
    avgIssueResponseDays,
    openIssueRatio,
    hasFunding,
    downloadTrend,
    weeklyDownloads: weeklyDl,
    hasOpenSecurityIssues: false,
  };
  const result = score(input, DEFAULT_WEIGHTS);

  console.log("");
  console.log(chalk.bold(`  ${packageName}`));
  console.log(`  ${chalk.dim("Grade:")} ${gradeColor(result.grade)(result.grade)} ${chalk.dim(`(score: ${result.score})`)}`);
  console.log(chalk.dim("  " + "─".repeat(50)));
  console.log("");

  console.log(chalk.bold("  Registry:"));
  console.log(
    `    ${chalk.dim("Deprecated:")}    ${registryInfo.deprecated ? chalk.red("Yes — " + registryInfo.deprecated) : chalk.green("No")}`,
  );
  console.log(
    `    ${chalk.dim("Last publish:")}  ${registryInfo.lastPublishDate ? timeAgo(registryInfo.lastPublishDate) : "Unknown"}`,
  );
  console.log(
    `    ${chalk.dim("Maintainers:")}   ${registryInfo.maintainers.map((m) => m.name).join(", ") || "Unknown"}`,
  );
  console.log(
    `    ${chalk.dim("Downloads:")}     ${formatDownloads(weeklyDl)}/week (${downloadTrend} ${TREND_ARROWS[downloadTrend]})`,
  );

  if (registryInfo.repoUrl) {
    console.log("");
    console.log(chalk.bold(`  GitHub: ${chalk.dim(registryInfo.repoUrl)}`));

    if (repoInfo) {
      console.log(
        `    ${chalk.dim("Archived:")}      ${repoInfo.archived ? chalk.red("Yes") : chalk.green("No")}`,
      );
      console.log(
        `    ${chalk.dim("Last push:")}     ${timeAgo(repoInfo.pushedAt)}`,
      );

      if (lastHumanCommit) {
        console.log(
          `    ${chalk.dim("Human commit:")}  ${timeAgo(lastHumanCommit)}`,
        );
      } else if (!repoInfo.archived) {
        console.log(
          `    ${chalk.dim("Human commit:")}  ${chalk.yellow("No human source commits in last 12 months")}`,
        );
      }

      console.log(
        `    ${chalk.dim("Bus factor:")}    ${busFactor === 0 ? chalk.red("0") : busFactor < 3 ? chalk.yellow(String(busFactor)) : chalk.green(String(busFactor))}${topContributors.length > 0 ? chalk.dim(` (${topContributors.slice(0, 5).map((c) => `@${c.login}`).join(", ")})`) : ""}`,
      );

      if (medianIssueResponseDays !== null) {
        const color = medianIssueResponseDays < 7 ? chalk.green : medianIssueResponseDays < 30 ? chalk.yellow : chalk.red;
        console.log(
          `    ${chalk.dim("Issue response:")} ${color(`${medianIssueResponseDays} days`)} median`,
        );
      }

      if (repoInfo.openIssuesCount > 0 || openIssueRatio > 0) {
        const pct = Math.round(openIssueRatio * 100);
        const color = pct < 40 ? chalk.green : pct < 60 ? chalk.yellow : chalk.red;
        console.log(
          `    ${chalk.dim("Open issues:")}   ${color(`${pct}%`)} open`,
        );
      }

      if (hasFunding) {
        console.log(
          `    ${chalk.dim("Funding:")}       ${chalk.green(fundingPlatforms.join(", ") || "Yes")}`,
        );
      } else {
        console.log(
          `    ${chalk.dim("Funding:")}       ${chalk.dim("None detected")}`,
        );
      }

      console.log(
        `    ${chalk.dim("Stars:")}         ${repoInfo.stargazersCount.toLocaleString()}`,
      );
    } else {
      console.log(chalk.dim("    Could not fetch repository data"));
    }
  }

  console.log("");
}

function gradeColor(grade: string): (s: string) => string {
  switch (grade) {
    case "A": return chalk.green;
    case "B": return chalk.greenBright;
    case "C": return chalk.yellow;
    case "D": return chalk.red;
    default: return chalk.bgRed.white;
  }
}
