import ora from "ora";
import chalk from "chalk";
import {
  analyzeHealth,
  detectManifest,
  type AnalyzeOptions,
  type Grade,
  type HealthReport,
} from "@epitaph-dev/core";
import { renderConsoleReport } from "../reporter/console.js";
import { renderJsonReport } from "../reporter/json.js";

export interface ScanOptions {
  manifest?: string;
  token?: string;
  productionOnly?: boolean;
  json?: boolean;
  verbose?: boolean;
  ignore?: string[];
  failGrade?: Grade;
  noCache?: boolean;
}

export async function scan(options: ScanOptions): Promise<void> {
  const manifestPath = options.manifest ?? (await resolveManifest());

  const spinner = options.json
    ? null
    : ora({ text: "Resolving dependencies...", spinner: "dots" }).start();

  let report: HealthReport;
  try {
    const analyzeOpts: AnalyzeOptions & { onProgress?: (name: string) => void } = {
      manifestPath,
      token: options.token ?? process.env.GITHUB_TOKEN ?? process.env.EPITAPH_GITHUB_TOKEN,
      productionOnly: options.productionOnly ?? false,
      ignore: options.ignore ?? [],
      noCache: options.noCache ?? false,
      onProgress: spinner
        ? (name: string) => {
            spinner.text = `Analyzing ${chalk.cyan(name)}...`;
          }
        : undefined,
    };

    report = await analyzeHealth(analyzeOpts);
    spinner?.stop();
  } catch (err) {
    spinner?.fail(err instanceof Error ? err.message : String(err));
    process.exit(2);
  }

  if (options.json) {
    process.stdout.write(renderJsonReport(report) + "\n");
  } else {
    process.stdout.write(renderConsoleReport(report, options.verbose));
  }

  if (options.failGrade) {
    const failThreshold = gradeToNumber(options.failGrade);
    const failing = report.dependencies.some(
      (d) => d.error === null && gradeToNumber(d.grade) <= failThreshold,
    );
    if (failing) {
      process.exit(1);
    }
  }
}

async function resolveManifest(): Promise<string> {
  const detected = await detectManifest(process.cwd());
  if (detected) return detected.path;

  console.error(
    chalk.red("No manifest found in current directory. Specify one with --manifest."),
  );
  process.exit(2);
}

function gradeToNumber(grade: Grade): number {
  const map: Record<Grade, number> = { A: 5, B: 4, C: 3, D: 2, F: 1 };
  return map[grade];
}
