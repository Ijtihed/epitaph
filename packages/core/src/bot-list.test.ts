import { describe, it, expect } from "vitest";
import { isBot, isSourceFile } from "./bot-list.js";

describe("isBot", () => {
  it("detects GitHub App bots", () => {
    expect(isBot("dependabot[bot]")).toBe(true);
    expect(isBot("renovate[bot]")).toBe(true);
    expect(isBot("github-actions[bot]")).toBe(true);
  });

  it("detects known bot accounts", () => {
    expect(isBot("dependabot")).toBe(true);
    expect(isBot("renovate")).toBe(true);
    expect(isBot("snyk-bot")).toBe(true);
    expect(isBot("imgbot")).toBe(true);
    expect(isBot("semantic-release-bot")).toBe(true);
    expect(isBot("release-please")).toBe(true);
  });

  it("detects generic bot patterns", () => {
    expect(isBot("my-custom-bot")).toBe(true);
    expect(isBot("bot-runner")).toBe(true);
    expect(isBot("auto-merger")).toBe(true);
  });

  it("does not flag humans", () => {
    expect(isBot("john-doe")).toBe(false);
    expect(isBot("botticelli")).toBe(false);
    expect(isBot("roboto")).toBe(false);
    expect(isBot("aboutme")).toBe(false);
  });
});

describe("isSourceFile", () => {
  it("identifies source files", () => {
    expect(isSourceFile("src/index.ts")).toBe(true);
    expect(isSourceFile("lib/utils.js")).toBe(true);
    expect(isSourceFile("app/components/Button.tsx")).toBe(true);
  });

  it("rejects CI configs", () => {
    expect(isSourceFile(".github/workflows/ci.yml")).toBe(false);
    expect(isSourceFile(".circleci/config.yml")).toBe(false);
    expect(isSourceFile(".travis.yml")).toBe(false);
  });

  it("rejects lockfiles", () => {
    expect(isSourceFile("package-lock.json")).toBe(false);
    expect(isSourceFile("yarn.lock")).toBe(false);
    expect(isSourceFile("pnpm-lock.yaml")).toBe(false);
    expect(isSourceFile("Cargo.lock")).toBe(false);
  });

  it("rejects documentation files", () => {
    expect(isSourceFile("README.md")).toBe(false);
    expect(isSourceFile("CHANGELOG.md")).toBe(false);
    expect(isSourceFile("LICENSE")).toBe(false);
    expect(isSourceFile("CONTRIBUTING.md")).toBe(false);
  });

  it("rejects config files", () => {
    expect(isSourceFile(".gitignore")).toBe(false);
    expect(isSourceFile(".editorconfig")).toBe(false);
  });
});
