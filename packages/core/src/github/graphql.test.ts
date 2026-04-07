import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { batchFetchRepos } from "./graphql.js";

describe("batchFetchRepos", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function makeGraphQLResponse(repoAliases: Record<string, unknown>) {
    return {
      ok: true,
      json: () => Promise.resolve({ data: repoAliases }),
    };
  }

  function makeRepoData(overrides: Record<string, unknown> = {}) {
    return {
      isArchived: false,
      pushedAt: "2026-03-15T00:00:00Z",
      stargazerCount: 1000,
      openIssues: { totalCount: 10 },
      closedIssues: { totalCount: 90 },
      fundingLinks: [],
      recentIssues: { nodes: [] },
      defaultBranchRef: {
        target: {
          history: {
            nodes: [],
          },
        },
      },
      ...overrides,
    };
  }

  it("returns parsed data for a single repo", async () => {
    fetchMock.mockResolvedValueOnce(
      makeGraphQLResponse({ repo0: makeRepoData() }),
    );

    const result = await batchFetchRepos("fake-token", [
      { owner: "expressjs", repo: "express" },
    ]);

    expect(result.size).toBe(1);
    const data = result.get("expressjs/express");
    expect(data).toBeDefined();
    expect(data!.isArchived).toBe(false);
    expect(data!.stargazerCount).toBe(1000);
    expect(data!.openIssueCount).toBe(10);
    expect(data!.closedIssueCount).toBe(90);
  });

  it("batches multiple repos in a single request (under 25)", async () => {
    fetchMock.mockResolvedValueOnce(
      makeGraphQLResponse({
        repo0: makeRepoData({ stargazerCount: 100 }),
        repo1: makeRepoData({ stargazerCount: 200 }),
        repo2: makeRepoData({ stargazerCount: 300 }),
      }),
    );

    const result = await batchFetchRepos("fake-token", [
      { owner: "a", repo: "one" },
      { owner: "b", repo: "two" },
      { owner: "c", repo: "three" },
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.size).toBe(3);
    expect(result.get("a/one")!.stargazerCount).toBe(100);
    expect(result.get("c/three")!.stargazerCount).toBe(300);
  });

  it("splits into multiple requests when over batch size", async () => {
    const repos = Array.from({ length: 8 }, (_, i) => ({
      owner: "org",
      repo: `repo${i}`,
    }));

    const batch1Data: Record<string, unknown> = {};
    for (let i = 0; i < 5; i++) {
      batch1Data[`repo${i}`] = makeRepoData({ stargazerCount: i });
    }
    const batch2Data: Record<string, unknown> = {};
    for (let i = 0; i < 3; i++) {
      batch2Data[`repo${i}`] = makeRepoData({ stargazerCount: 5 + i });
    }

    fetchMock
      .mockResolvedValueOnce(makeGraphQLResponse(batch1Data))
      .mockResolvedValueOnce(makeGraphQLResponse(batch2Data));

    const result = await batchFetchRepos("fake-token", repos);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.size).toBe(8);
  });

  it("handles null repos gracefully (private/deleted)", async () => {
    fetchMock.mockResolvedValueOnce(
      makeGraphQLResponse({
        repo0: makeRepoData(),
        repo1: null,
      }),
    );

    const result = await batchFetchRepos("fake-token", [
      { owner: "public", repo: "exists" },
      { owner: "private", repo: "gone" },
    ]);

    expect(result.size).toBe(1);
    expect(result.has("public/exists")).toBe(true);
    expect(result.has("private/gone")).toBe(false);
  });

  it("parses issue data with maintainer responses", async () => {
    fetchMock.mockResolvedValueOnce(
      makeGraphQLResponse({
        repo0: makeRepoData({
          recentIssues: {
            nodes: [
              {
                createdAt: "2026-03-01T00:00:00Z",
                comments: {
                  nodes: [
                    { createdAt: "2026-03-03T00:00:00Z", authorAssociation: "MEMBER" },
                  ],
                },
              },
            ],
          },
        }),
      }),
    );

    const result = await batchFetchRepos("fake-token", [
      { owner: "org", repo: "repo" },
    ]);

    const data = result.get("org/repo")!;
    expect(data.recentIssues).toHaveLength(1);
    expect(data.recentIssues[0].firstMaintainerResponseAt).toBe("2026-03-03T00:00:00Z");
  });

  it("parses commit data", async () => {
    fetchMock.mockResolvedValueOnce(
      makeGraphQLResponse({
        repo0: makeRepoData({
          defaultBranchRef: {
            target: {
              history: {
                nodes: [
                  {
                    author: { user: { login: "alice" } },
                    committedDate: "2026-03-10T00:00:00Z",
                    additions: 50,
                    deletions: 10,
                    changedFilesIfAvailable: 3,
                  },
                ],
              },
            },
          },
        }),
      }),
    );

    const result = await batchFetchRepos("fake-token", [
      { owner: "org", repo: "repo" },
    ]);

    const data = result.get("org/repo")!;
    expect(data.recentCommits).toHaveLength(1);
    expect(data.recentCommits[0].authorLogin).toBe("alice");
    expect(data.recentCommits[0].additions).toBe(50);
  });

  it("sends auth header with token", async () => {
    fetchMock.mockResolvedValueOnce(
      makeGraphQLResponse({ repo0: makeRepoData() }),
    );

    await batchFetchRepos("my-secret-token", [
      { owner: "org", repo: "repo" },
    ]);

    const callArgs = fetchMock.mock.calls[0];
    expect(callArgs[1].headers.Authorization).toBe("Bearer my-secret-token");
  });

  it("parses funding links", async () => {
    fetchMock.mockResolvedValueOnce(
      makeGraphQLResponse({
        repo0: makeRepoData({
          fundingLinks: [
            { platform: "GITHUB", url: "https://github.com/sponsors/user" },
            { platform: "OPEN_COLLECTIVE", url: "https://opencollective.com/proj" },
          ],
        }),
      }),
    );

    const result = await batchFetchRepos("fake-token", [
      { owner: "org", repo: "repo" },
    ]);

    const data = result.get("org/repo")!;
    expect(data.fundingLinks).toHaveLength(2);
    expect(data.fundingLinks[0].platform).toBe("GITHUB");
  });
});
