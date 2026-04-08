import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import type { EpitaphConfig } from "epitaph-dev-core";

const CONFIG_FILENAMES = [".epitaphrc.json", ".epitaphrc", "epitaph.config.json"];

export async function loadConfig(startDir: string): Promise<EpitaphConfig> {
  for (const filename of CONFIG_FILENAMES) {
    const configPath = resolve(startDir, filename);
    try {
      const raw = await readFile(configPath, "utf-8");
      return JSON.parse(raw) as EpitaphConfig;
    } catch {
      continue;
    }
  }
  return {};
}

export function resolveManifestPath(
  cliPath: string | undefined,
  config: EpitaphConfig,
): string {
  if (cliPath) return resolve(cliPath);
  if (config.manifests?.[0]) return resolve(config.manifests[0]);
  return resolve("package.json");
}
