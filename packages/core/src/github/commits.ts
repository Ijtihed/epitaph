import type { GitHubClient } from "./client.js";
import { isBot, isSourceFile } from "../bot-list.js";

interface GitHubCommitListItem {
  sha: string;
  commit: {
    author: {
      name: string;
      email: string;
      date: string;
    };
  };
  author: { login: string } | null;
}

interface GitHubCommitDetail {
  sha: string;
  commit: {
    author: {
      date: string;
    };
  };
  author: { login: string } | null;
  files?: Array<{ filename: string }>;
}

export interface CommitAnalysis {
  lastHumanCommit: Date | null;
  uniqueHumanAuthors: string[];
  authorCommitCounts: Map<string, number>;
}

const MAX_COMMITS_LIST = 50;
const MAX_DETAIL_FETCHES = 20;

export async function analyzeCommits(
  client: GitHubClient,
  owner: string,
  repo: string,
): Promise<CommitAnalysis> {
  const since = new Date();
  since.setFullYear(since.getFullYear() - 1);

  const commits = await client.request<GitHubCommitListItem[]>(
    `/repos/${owner}/${repo}/commits?per_page=${MAX_COMMITS_LIST}&since=${since.toISOString()}`,
  );

  const authorCounts = new Map<string, number>();
  const nonBotCommits: GitHubCommitListItem[] = [];

  for (const c of commits) {
    const login = c.author?.login;
    if (!login) continue;

    if (isBot(login)) continue;

    authorCounts.set(login, (authorCounts.get(login) ?? 0) + 1);
    nonBotCommits.push(c);
  }

  let lastHumanCommit: Date | null = null;

  const toCheck = nonBotCommits.slice(0, MAX_DETAIL_FETCHES);
  for (const c of toCheck) {
    try {
      const detail = await client.request<GitHubCommitDetail>(
        `/repos/${owner}/${repo}/commits/${c.sha}`,
      );

      const files = detail.files ?? [];
      if (files.length === 0 || files.some((f) => isSourceFile(f.filename))) {
        lastHumanCommit = new Date(detail.commit.author.date);
        break;
      }
    } catch {
      // If individual commit fetch fails, fall back to the list date
      lastHumanCommit = new Date(c.commit.author.date);
      break;
    }
  }

  return {
    lastHumanCommit,
    uniqueHumanAuthors: Array.from(authorCounts.keys()),
    authorCommitCounts: authorCounts,
  };
}
