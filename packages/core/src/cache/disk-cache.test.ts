import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DiskCache } from "./disk-cache.js";

let testDir: string;
let cache: DiskCache;

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), "epitaph-cache-test-"));
  cache = new DiskCache(testDir, 60_000);
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

describe("DiskCache", () => {
  it("returns null for missing keys", async () => {
    const result = await cache.get("nonexistent/key");
    expect(result).toBeNull();
  });

  it("stores and retrieves values", async () => {
    await cache.set("npm/express", { name: "express", version: "4.18.0" });
    const result = await cache.get<{ name: string; version: string }>("npm/express");
    expect(result).toEqual({ name: "express", version: "4.18.0" });
  });

  it("stores and retrieves complex objects", async () => {
    const data = {
      archived: false,
      pushedAt: "2026-03-15T00:00:00Z",
      contributors: [{ login: "alice", commits: 42 }],
    };
    await cache.set("github/expressjs/express", data);
    const result = await cache.get<typeof data>("github/expressjs/express");
    expect(result).toEqual(data);
  });

  it("returns null for expired entries", async () => {
    const shortTtlCache = new DiskCache(testDir, 1); // 1ms TTL
    await shortTtlCache.set("key", "value");
    await new Promise((resolve) => setTimeout(resolve, 10));
    const result = await shortTtlCache.get("key");
    expect(result).toBeNull();
  });

  it("returns value within TTL window", async () => {
    await cache.set("key", "value");
    const result = await cache.get("key");
    expect(result).toBe("value");
  });

  it("clear removes all cached entries", async () => {
    await cache.set("key1", "value1");
    await cache.set("key2", "value2");
    await cache.clear();
    expect(await cache.get("key1")).toBeNull();
    expect(await cache.get("key2")).toBeNull();
  });

  it("handles keys with slashes by replacing with __", async () => {
    await cache.set("github/owner/repo", { data: true });
    const result = await cache.get<{ data: boolean }>("github/owner/repo");
    expect(result).toEqual({ data: true });
  });

  it("handles concurrent writes to different keys", async () => {
    await Promise.all([
      cache.set("key1", "val1"),
      cache.set("key2", "val2"),
      cache.set("key3", "val3"),
    ]);
    expect(await cache.get("key1")).toBe("val1");
    expect(await cache.get("key2")).toBe("val2");
    expect(await cache.get("key3")).toBe("val3");
  });

  it("overwrites existing entries", async () => {
    await cache.set("key", "original");
    await cache.set("key", "updated");
    expect(await cache.get("key")).toBe("updated");
  });
});
