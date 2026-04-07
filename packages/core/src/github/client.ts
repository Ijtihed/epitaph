const GITHUB_API = "https://api.github.com";

export interface GitHubClientOptions {
  token?: string;
}

export class GitHubClient {
  private token?: string;
  private remainingRequests = Infinity;

  constructor(options: GitHubClientOptions = {}) {
    this.token = options.token;
  }

  async request<T>(path: string): Promise<T> {
    if (this.remainingRequests <= 5) {
      throw new Error(
        "GitHub API rate limit nearly exhausted. Provide a token with --token or GITHUB_TOKEN.",
      );
    }

    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "epitaph-dev",
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const res = await fetch(`${GITHUB_API}${path}`, { headers });

    const remaining = res.headers.get("x-ratelimit-remaining");
    if (remaining) {
      this.remainingRequests = parseInt(remaining, 10);
    }

    if (res.status === 404) {
      throw new GitHubNotFoundError(path);
    }

    if (res.status === 403 && this.remainingRequests <= 0) {
      const reset = res.headers.get("x-ratelimit-reset");
      const resetDate = reset ? new Date(parseInt(reset, 10) * 1000) : null;
      throw new GitHubRateLimitError(resetDate);
    }

    if (!res.ok) {
      throw new Error(`GitHub API returned ${res.status} for ${path}`);
    }

    return res.json() as Promise<T>;
  }

  getRemainingRequests(): number {
    return this.remainingRequests;
  }
}

export class GitHubNotFoundError extends Error {
  constructor(path: string) {
    super(`GitHub resource not found: ${path}`);
    this.name = "GitHubNotFoundError";
  }
}

export class GitHubRateLimitError extends Error {
  resetAt: Date | null;

  constructor(resetAt: Date | null) {
    const msg = resetAt
      ? `GitHub rate limit exceeded. Resets at ${resetAt.toISOString()}`
      : "GitHub rate limit exceeded.";
    super(msg);
    this.name = "GitHubRateLimitError";
    this.resetAt = resetAt;
  }
}
