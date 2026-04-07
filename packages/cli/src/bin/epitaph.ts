import { Command } from "commander";
import { scan } from "../commands/scan.js";
import { init } from "../commands/init.js";
import { explain } from "../commands/explain.js";
import type { Grade } from "@epitaph-dev/core";

const program = new Command();

program
  .name("epitaph")
  .description("Your dependencies are dying. epitaph finds the bodies.")
  .version("0.1.0");

program
  .command("scan", { isDefault: true })
  .description("Scan dependency manifest for maintenance health")
  .option("-m, --manifest <path>", "Path to manifest file (auto-detected if omitted)")
  .option("-t, --token <token>", "GitHub personal access token")
  .option("-p, --production-only", "Only scan production dependencies", false)
  .option("-j, --json", "Output as JSON", false)
  .option("-v, --verbose", "Show errors and extra details", false)
  .option("--ignore <packages...>", "Packages to ignore")
  .option("--fail-grade <grade>", "Exit 1 if any dep scores at or below this grade")
  .option("--no-cache", "Skip disk cache (fetch fresh data)")
  .action(async (opts) => {
    await scan({
      manifest: opts.manifest,
      token: opts.token,
      productionOnly: opts.productionOnly,
      json: opts.json,
      verbose: opts.verbose,
      ignore: opts.ignore,
      failGrade: opts.failGrade as Grade | undefined,
      noCache: opts.cache === false,
    });
  });

program
  .command("init")
  .description("Generate .epitaphrc.json with smart defaults")
  .action(async () => {
    await init();
  });

program
  .command("explain <package>")
  .description("Deep-dive into one dependency's health signals")
  .option("-t, --token <token>", "GitHub personal access token")
  .action(async (packageName: string, opts) => {
    await explain(packageName, { token: opts.token });
  });

program.parse();
