import type { GitHubClient } from "./client.js";
import type { RepoInfo } from "../types.js";

interface GitHubRepoResponse {
  archived: boolean;
  pushed_at: string;
  open_issues_count: number;
  stargazers_count: number;
  fork: boolean;
  owner: { login: string };
  name: string;
}

export function parseGitHubUrl(
  url: string,
): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) return null;
  return {
    owner: match[1],
    repo: match[2].replace(/\.git$/, "").replace(/#.*$/, ""),
  };
}

export async function fetchRepoInfo(
  client: GitHubClient,
  owner: string,
  repo: string,
): Promise<RepoInfo> {
  const data = await client.request<GitHubRepoResponse>(
    `/repos/${owner}/${repo}`,
  );

  return {
    owner: data.owner.login,
    repo: data.name,
    archived: data.archived,
    pushedAt: new Date(data.pushed_at),
    openIssuesCount: data.open_issues_count,
    stargazersCount: data.stargazers_count,
    isFork: data.fork,
  };
}
