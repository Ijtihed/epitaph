import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Dependency } from "../types.js";

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export async function parseNpmManifest(
  manifestPath: string,
  productionOnly: boolean = false,
): Promise<Dependency[]> {
  const fullPath = resolve(manifestPath);
  const raw = await readFile(fullPath, "utf-8");
  const pkg: PackageJson = JSON.parse(raw);

  const deps: Dependency[] = [];

  if (pkg.dependencies) {
    for (const [name, version] of Object.entries(pkg.dependencies)) {
      deps.push({ name, version, isDev: false, ecosystem: "npm" });
    }
  }

  if (!productionOnly && pkg.devDependencies) {
    for (const [name, version] of Object.entries(pkg.devDependencies)) {
      deps.push({ name, version, isDev: true, ecosystem: "npm" });
    }
  }

  return deps;
}
