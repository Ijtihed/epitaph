import { access } from "node:fs/promises";
import { join, basename } from "node:path";
import type { Ecosystem } from "../types.js";

interface DetectedManifest {
  path: string;
  ecosystem: Ecosystem;
}

const MANIFEST_MAP: Record<string, Ecosystem> = {
  "package.json": "npm",
  "requirements.txt": "pypi",
  "pyproject.toml": "pypi",
  "Cargo.toml": "cargo",
  "go.mod": "go",
  "Gemfile": "ruby",
};

export async function detectManifest(
  directory: string,
): Promise<DetectedManifest | null> {
  for (const [filename, ecosystem] of Object.entries(MANIFEST_MAP)) {
    const fullPath = join(directory, filename);
    try {
      await access(fullPath);
      return { path: fullPath, ecosystem };
    } catch {
      continue;
    }
  }
  return null;
}

export function ecosystemFromManifest(manifestPath: string): Ecosystem {
  const filename = basename(manifestPath);
  return MANIFEST_MAP[filename] ?? "npm";
}
