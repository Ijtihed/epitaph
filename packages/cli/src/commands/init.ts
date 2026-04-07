import { writeFile, access } from "node:fs/promises";
import { resolve } from "node:path";
import chalk from "chalk";
import { detectManifest, type EpitaphConfig } from "@epitaph-dev/core";

const DEFAULT_IGNORE = [
  "@types/*",
  "typescript",
  "prettier",
  "eslint",
];

export async function init(): Promise<void> {
  const configPath = resolve(".epitaphrc.json");

  try {
    await access(configPath);
    console.log(chalk.yellow(".epitaphrc.json already exists. Skipping."));
    return;
  } catch {
    // file doesn't exist — good
  }

  const manifest = await detectManifest(process.cwd());
  const config: EpitaphConfig = {
    manifests: manifest ? [manifest.path] : ["package.json"],
    ignore: DEFAULT_IGNORE,
    "production-only": true,
    "fail-grade": "D",
    "cache-ttl": 24,
  };

  await writeFile(configPath, JSON.stringify(config, null, 2) + "\n");
  console.log(chalk.green("Created .epitaphrc.json with default settings."));
  console.log(chalk.dim("Edit the ignore list to suppress false positives on 'done' packages."));
}
