import { describe, it, expect } from "vitest";
import { analyzeFunding } from "./funding.js";

describe("analyzeFunding", () => {
  it("returns no funding when no links provided", () => {
    const result = analyzeFunding([]);
    expect(result.hasFunding).toBe(false);
    expect(result.platforms).toEqual([]);
  });

  it("returns no funding when undefined", () => {
    const result = analyzeFunding(undefined);
    expect(result.hasFunding).toBe(false);
    expect(result.platforms).toEqual([]);
  });

  it("detects funding from GitHub Sponsors", () => {
    const result = analyzeFunding([
      { platform: "GITHUB", url: "https://github.com/sponsors/user" },
    ]);
    expect(result.hasFunding).toBe(true);
    expect(result.platforms).toEqual(["github"]);
  });

  it("detects multiple funding platforms", () => {
    const result = analyzeFunding([
      { platform: "GITHUB", url: "https://github.com/sponsors/user" },
      { platform: "OPEN_COLLECTIVE", url: "https://opencollective.com/proj" },
      { platform: "TIDELIFT", url: "https://tidelift.com/sub/pkg" },
    ]);
    expect(result.hasFunding).toBe(true);
    expect(result.platforms).toHaveLength(3);
    expect(result.platforms).toContain("github");
    expect(result.platforms).toContain("open_collective");
    expect(result.platforms).toContain("tidelift");
  });
});
