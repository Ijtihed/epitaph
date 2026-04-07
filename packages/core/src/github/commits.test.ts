import { describe, it, expect, vi, beforeEach } from "vitest";
import { analyzeCommits } from "./commits.js";
import { GitHubClient } from "./client.js";

function makeCommitListItem(login: string, date: string, sha: string) {
  return {
    sha,
    commit: { author: { name: login, email: `${login}@test.com`, date } },
    author: { login },
  };
}

function makeCommitDetail(
  login: string,
  date: string,
  sha: string,
  files: string[],
) {
  return {
    sha,
    commit: { author: { date } },
    author: { login },
    files: files.map((f) => ({ filename: f })),
  };
}

describe("analyzeCommits", () => {
  let client: GitHubClient;
  let requestMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    client = new GitHubClient();
    requestMock = vi.fn();
    client.request = requestMock;
  });

  it("filters out bot authors from unique human authors", async () => {
    requestMock.mockImplementation((path: string) => {
      if (path.includes("/commits?")) {
        return Promise.resolve([
          makeCommitListItem("real-dev", "2026-03-01T00:00:00Z", "abc123"),
          makeCommitListItem("dependabot[bot]", "2026-03-02T00:00:00Z", "def456"),
          makeCommitListItem("renovate[bot]", "2026-03-03T00:00:00Z", "ghi789"),
          makeCommitListItem("another-human", "2026-02-15T00:00:00Z", "jkl012"),
          makeCommitListItem("snyk-bot", "2026-02-10T00:00:00Z", "mno345"),
        ]);
      }
      // Individual commit detail — return source files
      return Promise.resolve(
        makeCommitDetail("real-dev", "2026-03-01T00:00:00Z", "abc123", [
          "src/index.ts",
        ]),
      );
    });

    const result = await analyzeCommits(client, "owner", "repo");

    expect(result.uniqueHumanAuthors).toEqual(["real-dev", "another-human"]);
    expect(result.uniqueHumanAuthors).not.toContain("dependabot[bot]");
    expect(result.uniqueHumanAuthors).not.toContain("renovate[bot]");
    expect(result.uniqueHumanAuthors).not.toContain("snyk-bot");
  });

  it("skips commits that only touch non-source files", async () => {
    requestMock.mockImplementation((path: string) => {
      if (path.includes("/commits?")) {
        return Promise.resolve([
          makeCommitListItem("dev1", "2026-03-10T00:00:00Z", "sha1"),
          makeCommitListItem("dev2", "2026-03-05T00:00:00Z", "sha2"),
        ]);
      }
      if (path.includes("sha1")) {
        return Promise.resolve(
          makeCommitDetail("dev1", "2026-03-10T00:00:00Z", "sha1", [
            "README.md",
            ".github/workflows/ci.yml",
          ]),
        );
      }
      if (path.includes("sha2")) {
        return Promise.resolve(
          makeCommitDetail("dev2", "2026-03-05T00:00:00Z", "sha2", [
            "src/lib.ts",
            "README.md",
          ]),
        );
      }
      return Promise.resolve({});
    });

    const result = await analyzeCommits(client, "owner", "repo");

    // sha1 only touches non-source, sha2 touches src/lib.ts
    expect(result.lastHumanCommit?.toISOString()).toBe("2026-03-05T00:00:00.000Z");
  });

  it("returns null lastHumanCommit when all commits are bots", async () => {
    requestMock.mockImplementation((path: string) => {
      if (path.includes("/commits?")) {
        return Promise.resolve([
          makeCommitListItem("dependabot[bot]", "2026-03-01T00:00:00Z", "sha1"),
          makeCommitListItem("renovate[bot]", "2026-02-01T00:00:00Z", "sha2"),
        ]);
      }
      return Promise.resolve({});
    });

    const result = await analyzeCommits(client, "owner", "repo");

    expect(result.lastHumanCommit).toBeNull();
    expect(result.uniqueHumanAuthors).toEqual([]);
  });

  it("returns null lastHumanCommit when repo has no commits", async () => {
    requestMock.mockImplementation((path: string) => {
      if (path.includes("/commits?")) {
        return Promise.resolve([]);
      }
      return Promise.resolve({});
    });

    const result = await analyzeCommits(client, "owner", "repo");

    expect(result.lastHumanCommit).toBeNull();
    expect(result.uniqueHumanAuthors).toEqual([]);
  });

  it("counts commit totals per human author", async () => {
    requestMock.mockImplementation((path: string) => {
      if (path.includes("/commits?")) {
        return Promise.resolve([
          makeCommitListItem("alice", "2026-03-10T00:00:00Z", "sha1"),
          makeCommitListItem("alice", "2026-03-09T00:00:00Z", "sha2"),
          makeCommitListItem("alice", "2026-03-08T00:00:00Z", "sha3"),
          makeCommitListItem("bob", "2026-03-07T00:00:00Z", "sha4"),
          makeCommitListItem("dependabot[bot]", "2026-03-06T00:00:00Z", "sha5"),
        ]);
      }
      return Promise.resolve(
        makeCommitDetail("alice", "2026-03-10T00:00:00Z", "sha1", ["src/index.ts"]),
      );
    });

    const result = await analyzeCommits(client, "owner", "repo");

    expect(result.authorCommitCounts.get("alice")).toBe(3);
    expect(result.authorCommitCounts.get("bob")).toBe(1);
    expect(result.authorCommitCounts.has("dependabot[bot]")).toBe(false);
  });

  it("skips commits with null author login", async () => {
    requestMock.mockImplementation((path: string) => {
      if (path.includes("/commits?")) {
        return Promise.resolve([
          {
            sha: "sha1",
            commit: { author: { name: "ghost", email: "ghost@test.com", date: "2026-03-01T00:00:00Z" } },
            author: null,
          },
          makeCommitListItem("real-dev", "2026-02-28T00:00:00Z", "sha2"),
        ]);
      }
      return Promise.resolve(
        makeCommitDetail("real-dev", "2026-02-28T00:00:00Z", "sha2", ["src/main.ts"]),
      );
    });

    const result = await analyzeCommits(client, "owner", "repo");

    expect(result.uniqueHumanAuthors).toEqual(["real-dev"]);
    expect(result.lastHumanCommit?.toISOString()).toBe("2026-02-28T00:00:00.000Z");
  });
});
