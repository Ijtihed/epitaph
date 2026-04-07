import { describe, it, expect } from "vitest";
import { parseGitHubUrl } from "./repo-info.js";

describe("parseGitHubUrl", () => {
  it("parses HTTPS URLs", () => {
    expect(parseGitHubUrl("https://github.com/expressjs/express")).toEqual({
      owner: "expressjs",
      repo: "express",
    });
  });

  it("strips .git suffix", () => {
    expect(
      parseGitHubUrl("https://github.com/expressjs/express.git"),
    ).toEqual({
      owner: "expressjs",
      repo: "express",
    });
  });

  it("strips fragment identifiers", () => {
    expect(
      parseGitHubUrl("https://github.com/user/repo#readme"),
    ).toEqual({
      owner: "user",
      repo: "repo",
    });
  });

  it("handles git+https URLs", () => {
    expect(
      parseGitHubUrl("https://github.com/lodash/lodash.git"),
    ).toEqual({
      owner: "lodash",
      repo: "lodash",
    });
  });

  it("returns null for non-GitHub URLs", () => {
    expect(parseGitHubUrl("https://gitlab.com/user/repo")).toBeNull();
    expect(parseGitHubUrl("https://bitbucket.org/user/repo")).toBeNull();
    expect(parseGitHubUrl("not-a-url")).toBeNull();
  });
});
