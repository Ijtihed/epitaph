import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

interface CacheEntry<T> {
  _cachedAt: number;
  data: T;
}

export const DEFAULT_CACHE_DIR = join(homedir(), ".epitaph", "cache");
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function keyToFilename(key: string): string {
  return key.replace(/\//g, "__") + ".json";
}

export class DiskCache {
  private cacheDir: string;
  private ttlMs: number;
  private initialized = false;

  constructor(cacheDir: string = DEFAULT_CACHE_DIR, ttlMs: number = DEFAULT_TTL_MS) {
    this.cacheDir = cacheDir;
    this.ttlMs = ttlMs;
  }

  private async ensureDir(): Promise<void> {
    if (this.initialized) return;
    await mkdir(this.cacheDir, { recursive: true });
    this.initialized = true;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const filepath = join(this.cacheDir, keyToFilename(key));
      const raw = await readFile(filepath, "utf-8");
      const entry = JSON.parse(raw) as CacheEntry<T>;

      if (Date.now() - entry._cachedAt > this.ttlMs) {
        return null;
      }

      return entry.data;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.ensureDir();
    const filepath = join(this.cacheDir, keyToFilename(key));
    const entry: CacheEntry<T> = {
      _cachedAt: Date.now(),
      data: value,
    };
    await writeFile(filepath, JSON.stringify(entry), "utf-8");
  }

  async clear(): Promise<void> {
    try {
      await rm(this.cacheDir, { recursive: true, force: true });
      this.initialized = false;
    } catch {
      // directory may not exist
    }
  }
}
