import chalk from "chalk";
import type { HealthReport, DependencyHealth, Grade } from "epitaph-dev-core";

const GRADE_COLORS: Record<Grade, (s: string) => string> = {
  A: chalk.green,
  B: chalk.greenBright,
  C: chalk.yellow,
  D: chalk.red,
  F: chalk.bgRed.white,
};

function gradeLabel(grade: Grade): string {
  return GRADE_COLORS[grade](` ${grade} `);
}

function padRight(str: string, len: number): string {
  const visible = str.replace(
    // eslint-disable-next-line no-control-regex
    /\x1b\[[0-9;]*m/g,
    "",
  );
  const pad = Math.max(0, len - visible.length);
  return str + " ".repeat(pad);
}

function formatSignals(dep: DependencyHealth): string {
  return dep.signals.map((s) => `${s.emoji}  ${s.value}`).join(" · ");
}

export function renderConsoleReport(
  report: HealthReport,
  verbose: boolean = false,
): string {
  const lines: string[] = [];

  lines.push("");
  lines.push(
    chalk.bold(`  epitaph v0.1.0`) +
      chalk.dim(
        ` — scanning ${report.manifestPath} (${report.summary.total} dependencies)`,
      ),
  );
  lines.push("");

  const header =
    chalk.dim("  GRADE  ") +
    padRight(chalk.dim("PACKAGE"), 30) +
    chalk.dim("SIGNALS");
  lines.push(header);
  lines.push(chalk.dim("  " + "━".repeat(72)));

  for (const dep of report.dependencies) {
    if (dep.error && !verbose) continue;

    const grade = padRight(gradeLabel(dep.grade), 9);
    const name = padRight(
      dep.isDev ? chalk.dim(dep.name) : dep.name,
      30,
    );
    const signals = formatSignals(dep);
    const devTag = dep.isDev ? chalk.dim(" (dev)") : "";

    lines.push(`  ${grade}${name}${signals}${devTag}`);
  }

  lines.push(chalk.dim("  " + "━".repeat(72)));
  lines.push("");

  const { total, dead, warning, caution, healthy } = report.summary;
  const summaryParts: string[] = [
    `${total} scanned`,
    dead > 0 ? chalk.red(`${dead} dead`) : null,
    warning > 0 ? chalk.yellow(`${warning} warning`) : null,
    caution > 0 ? chalk.yellow(`${caution} caution`) : null,
    chalk.green(`${healthy} healthy`),
  ].filter(Boolean) as string[];

  lines.push(`  ${summaryParts.join(" · ")}`);
  lines.push("");

  const errCount = report.dependencies.filter((d) => d.error).length;
  if (errCount > 0) {
    lines.push(
      chalk.dim(`  ${errCount} package(s) could not be analyzed (use --verbose for details)`),
    );
    lines.push("");
  }

  lines.push(
    chalk.dim("  Run `epitaph explain <package>` for full signal breakdown."),
  );
  lines.push("");

  return lines.join("\n");
}
