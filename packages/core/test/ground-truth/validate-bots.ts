/**
 * Bot filter validation — manual review script.
 *
 * Fetches the last 50 commits from well-known repos and classifies each
 * as BOT or HUMAN using the isBot() filter. Review the output visually
 * to confirm no humans are misclassified and no bots slip through.
 *
 * Run:  npx tsx packages/core/test/ground-truth/validate-bots.ts
 * Requires GITHUB_TOKEN env var.
 */

import { isBot, isSourceFile } from "../../src/bot-list.js";

interface CommitListItem {
  sha: string;
  commit: {
    message: string;
    author: { date: string };
  };
  author: { login: string } | null;
  committer: { login: string } | null;
}

interface CommitDetail {
  sha: string;
  files?: Array<{ filename: string }>;
}

const REPOS = [
  "expressjs/express",
  "chalk/chalk",
  "colinhacks/zod",
  "vercel/ms",
  "lodash/lodash",
  "evanw/esbuild",
  "fastify/fastify",
  "vercel/next.js",
  "facebook/react",
  "microsoft/TypeScript",
];

const COMMITS_PER_REPO = 50;

async function ghFetch<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

async function main() {
  const token = process.env.GITHUB_TOKEN ?? process.env.EPITAPH_GITHUB_TOKEN;
  if (!token) {
    console.error("Error: GITHUB_TOKEN is required to fetch commits.");
    process.exit(1);
  }

  console.log("BOT FILTER VALIDATION");
  console.log("=====================\n");
  console.log("Legend:  [BOT]   = classified as bot by isBot()");
  console.log("        [HUMAN] = classified as human");
  console.log("        [???]   = no author login available\n");

  let totalCommits = 0;
  let totalBot = 0;
  let totalHuman = 0;
  let totalUnknown = 0;

  for (const repoFull of REPOS) {
    console.log(`\n── ${repoFull} ──────────────────────────────`);

    let commits: CommitListItem[];
    try {
      const since = new Date();
      since.setFullYear(since.getFullYear() - 1);
      commits = await ghFetch<CommitListItem[]>(
        `/repos/${repoFull}/commits?per_page=${COMMITS_PER_REPO}&since=${since.toISOString()}`,
        token,
      );
    } catch (err) {
      console.log(`  ⚠️  Failed to fetch: ${err instanceof Error ? err.message : err}`);
      continue;
    }

    let repoBots = 0;
    let repoHumans = 0;

    for (const c of commits) {
      const login = c.author?.login ?? c.committer?.login;
      const msg = c.commit.message.split("\n")[0].slice(0, 72);
      const date = c.commit.author.date.slice(0, 10);

      if (!login) {
        console.log(`  [???]   ${date}  (no login)         "${msg}"`);
        totalUnknown++;
        continue;
      }

      const bot = isBot(login);
      const tag = bot ? "[BOT]  " : "[HUMAN]";

      if (bot) {
        repoBots++;
        totalBot++;
      } else {
        repoHumans++;
        totalHuman++;
      }
      totalCommits++;

      console.log(`  ${tag} ${date}  @${login.padEnd(24)} "${msg}"`);
    }

    // Check a sample of commits for source vs non-source files
    const sampleSize = Math.min(5, commits.length);
    let sourceFileCommits = 0;
    let nonSourceOnlyCommits = 0;

    for (let i = 0; i < sampleSize; i++) {
      try {
        const detail = await ghFetch<CommitDetail>(
          `/repos/${repoFull}/commits/${commits[i].sha}`,
          token,
        );
        const files = detail.files ?? [];
        const hasSource = files.length === 0 || files.some((f) => isSourceFile(f.filename));
        if (hasSource) sourceFileCommits++;
        else nonSourceOnlyCommits++;
      } catch {
        // skip individual failures
      }
    }

    console.log(`\n  Summary: ${repoHumans} human, ${repoBots} bot out of ${commits.length} commits`);
    console.log(`  Source file check (sample of ${sampleSize}): ${sourceFileCommits} with source files, ${nonSourceOnlyCommits} non-source only`);
  }

  console.log("\n\n═══════════════════════════════════════════");
  console.log("TOTALS");
  console.log(`  Commits analyzed: ${totalCommits}`);
  console.log(`  Human:  ${totalHuman}`);
  console.log(`  Bot:    ${totalBot}`);
  console.log(`  No login: ${totalUnknown}`);
  console.log("");
  console.log("Review the output above for:");
  console.log("  1. Humans misclassified as [BOT] — false positives");
  console.log("  2. Bots misclassified as [HUMAN] — false negatives");
  console.log("  3. Source file filter excluding real code changes");
}

main().catch((err) => {
  console.error("Bot validation failed:", err);
  process.exit(2);
});
