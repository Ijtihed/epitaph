const GITHUB_GRAPHQL = "https://api.github.com/graphql";
const BATCH_SIZE = 5;

export interface GraphQLRepoData {
  isArchived: boolean;
  pushedAt: string;
  stargazerCount: number;
  openIssueCount: number;
  closedIssueCount: number;
  fundingLinks: Array<{ platform: string; url: string }>;
  recentIssues: Array<{
    createdAt: string;
    firstMaintainerResponseAt: string | null;
  }>;
  recentCommits: Array<{
    authorLogin: string | null;
    committedDate: string;
    additions: number;
    deletions: number;
    changedFiles: number;
  }>;
}

interface GraphQLResponse {
  data?: Record<string, RawRepoResult | null>;
  errors?: Array<{ message: string; path?: string[] }>;
}

interface RawRepoResult {
  isArchived: boolean;
  pushedAt: string;
  stargazerCount: number;
  openIssues: { totalCount: number };
  closedIssues: { totalCount: number };
  fundingLinks: Array<{ platform: string; url: string }>;
  recentIssues: {
    nodes: Array<{
      createdAt: string;
      comments: {
        nodes: Array<{
          createdAt: string;
          authorAssociation: string;
        }>;
      };
    }>;
  };
  defaultBranchRef: {
    target: {
      history: {
        nodes: Array<{
          author: { user: { login: string } | null } | null;
          committedDate: string;
          additions: number;
          deletions: number;
          changedFilesIfAvailable: number | null;
        }>;
      };
    };
  } | null;
}

const MAINTAINER_ASSOCIATIONS = new Set([
  "MEMBER",
  "COLLABORATOR",
  "OWNER",
]);

function buildRepoFragment(alias: string, owner: string, repo: string, sinceISO: string): string {
  return `  ${alias}: repository(owner: "${owner}", name: "${repo}") {
    isArchived
    pushedAt
    stargazerCount
    openIssues: issues(states: [OPEN]) { totalCount }
    closedIssues: issues(states: [CLOSED]) { totalCount }
    fundingLinks { platform url }
    recentIssues: issues(last: 20, orderBy: {field: CREATED_AT, direction: DESC}) {
      nodes {
        createdAt
        comments(first: 10) {
          nodes {
            createdAt
            authorAssociation
          }
        }
      }
    }
    defaultBranchRef {
      target {
        ... on Commit {
          history(first: 50, since: "${sinceISO}") {
            nodes {
              author { user { login } }
              committedDate
              additions
              deletions
              changedFilesIfAvailable
            }
          }
        }
      }
    }
  }`;
}

function parseRepoResult(raw: RawRepoResult): GraphQLRepoData {
  const recentIssues = raw.recentIssues.nodes.map((issue) => {
    const maintainerComment = issue.comments.nodes.find((c) =>
      MAINTAINER_ASSOCIATIONS.has(c.authorAssociation),
    );
    return {
      createdAt: issue.createdAt,
      firstMaintainerResponseAt: maintainerComment?.createdAt ?? null,
    };
  });

  const commitNodes = raw.defaultBranchRef?.target?.history?.nodes ?? [];
  const recentCommits = commitNodes.map((c) => ({
    authorLogin: c.author?.user?.login ?? null,
    committedDate: c.committedDate,
    additions: c.additions,
    deletions: c.deletions,
    changedFiles: c.changedFilesIfAvailable ?? 0,
  }));

  return {
    isArchived: raw.isArchived,
    pushedAt: raw.pushedAt,
    stargazerCount: raw.stargazerCount,
    openIssueCount: raw.openIssues.totalCount,
    closedIssueCount: raw.closedIssues.totalCount,
    fundingLinks: raw.fundingLinks,
    recentIssues,
    recentCommits,
  };
}

async function executeBatchQuery(
  token: string,
  batch: Array<{ owner: string; repo: string }>,
  sinceISO: string,
): Promise<Map<string, GraphQLRepoData>> {
  const result = new Map<string, GraphQLRepoData>();
  const fragments = batch.map((r, idx) =>
    buildRepoFragment(`repo${idx}`, r.owner, r.repo, sinceISO),
  );
  const query = `{\n${fragments.join("\n")}\n}`;

  const res = await fetch(GITHUB_GRAPHQL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "epitaph-dev",
    },
    body: JSON.stringify({ query }),
  });

  if (!res.ok) {
    throw new Error(`GitHub GraphQL returned ${res.status}`);
  }

  const json = (await res.json()) as GraphQLResponse;

  if (!json.data) {
    const msg = json.errors?.map((e) => e.message).join("; ") ?? "Unknown GraphQL error";
    throw new Error(`GitHub GraphQL error: ${msg}`);
  }

  for (let idx = 0; idx < batch.length; idx++) {
    const alias = `repo${idx}`;
    const raw = json.data[alias];
    if (!raw) continue;

    const key = `${batch[idx].owner}/${batch[idx].repo}`;
    try {
      result.set(key, parseRepoResult(raw));
    } catch {
      // malformed data for this repo — skip
    }
  }

  return result;
}

export async function batchFetchRepos(
  token: string,
  repos: Array<{ owner: string; repo: string }>,
): Promise<Map<string, GraphQLRepoData>> {
  const result = new Map<string, GraphQLRepoData>();
  const since = new Date();
  since.setFullYear(since.getFullYear() - 1);
  const sinceISO = since.toISOString();

  for (let i = 0; i < repos.length; i += BATCH_SIZE) {
    const batch = repos.slice(i, i + BATCH_SIZE);
    try {
      const batchResult = await executeBatchQuery(token, batch, sinceISO);
      for (const [k, v] of batchResult) result.set(k, v);
    } catch {
      // Batch too complex or transient 502 — retry repos individually.
      for (const repo of batch) {
        try {
          const single = await executeBatchQuery(token, [repo], sinceISO);
          for (const [k, v] of single) result.set(k, v);
        } catch {
          // This repo failed even alone — orchestrator will fall back to REST.
        }
      }
    }
  }

  return result;
}
