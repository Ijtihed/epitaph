import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { parseNpmManifest } from "./npm.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = resolve(__dirname, "../test/fixtures/package.json");

describe("parseNpmManifest", () => {
  it("parses production and dev dependencies", async () => {
    const deps = await parseNpmManifest(FIXTURE_PATH);
    expect(deps).toHaveLength(5);

    const names = deps.map((d) => d.name);
    expect(names).toContain("express");
    expect(names).toContain("request");
    expect(names).toContain("lodash");
    expect(names).toContain("typescript");
    expect(names).toContain("vitest");
  });

  it("marks dev dependencies correctly", async () => {
    const deps = await parseNpmManifest(FIXTURE_PATH);
    const ts = deps.find((d) => d.name === "typescript");
    expect(ts?.isDev).toBe(true);

    const express = deps.find((d) => d.name === "express");
    expect(express?.isDev).toBe(false);
  });

  it("skips dev dependencies when productionOnly is true", async () => {
    const deps = await parseNpmManifest(FIXTURE_PATH, true);
    expect(deps).toHaveLength(3);
    expect(deps.every((d) => !d.isDev)).toBe(true);
  });

  it("sets ecosystem to npm", async () => {
    const deps = await parseNpmManifest(FIXTURE_PATH);
    expect(deps.every((d) => d.ecosystem === "npm")).toBe(true);
  });

  it("preserves version strings", async () => {
    const deps = await parseNpmManifest(FIXTURE_PATH);
    const express = deps.find((d) => d.name === "express");
    expect(express?.version).toBe("^4.18.0");
  });
});
