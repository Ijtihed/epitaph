/**
 * Ground truth validation runner.
 *
 * NOT a unit test — hits live npm + GitHub APIs.
 * Run:  npx tsx packages/core/test/ground-truth/validate.ts
 * Requires GITHUB_TOKEN env var for full signal coverage.
 */

import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { analyzeHealth } from "../../src/index.js";
import type { Grade, DependencyHealth } from "../../src/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface TruthEntry {
  name: string;
  category: string;
  expectedGrade?: Grade;
  expectedMinGrade?: Grade;
  expectedMaxGrade?: Grade;
  reason: string;
}

const GRADE_ORDER: Record<Grade, number> = { A: 5, B: 4, C: 3, D: 2, F: 1 };

function gradeAtLeast(actual: Grade, min: Grade): boolean {
  return GRADE_ORDER[actual] >= GRADE_ORDER[min];
}

function gradeAtMost(actual: Grade, max: Grade): boolean {
  return GRADE_ORDER[actual] <= GRADE_ORDER[max];
}

function checkPass(entry: TruthEntry, actual: Grade): boolean {
  if (entry.expectedGrade) return actual === entry.expectedGrade;
  const minOk = entry.expectedMinGrade ? gradeAtLeast(actual, entry.expectedMinGrade) : true;
  const maxOk = entry.expectedMaxGrade ? gradeAtMost(actual, entry.expectedMaxGrade) : true;
  return minOk && maxOk;
}

function expectedLabel(entry: TruthEntry): string {
  if (entry.expectedGrade) return entry.expectedGrade;
  const min = entry.expectedMinGrade ?? "F";
  const max = entry.expectedMaxGrade ?? "A";
  return min === max ? min : `${min}-${max}`;
}

function formatDownloads(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

async function main() {
  const token = process.env.GITHUB_TOKEN ?? process.env.EPITAPH_GITHUB_TOKEN;
  if (!token) {
    console.error("⚠️  GITHUB_TOKEN not set. Results will be limited (no issue/funding signals).");
    console.error("   Set GITHUB_TOKEN for full validation.\n");
  }

  const truthPath = join(__dirname, "truth.json");
  const entries: TruthEntry[] = JSON.parse(readFileSync(truthPath, "utf-8"));

  const tmpDir = mkdtempSync(join(tmpdir(), "epitaph-validate-"));
  const manifestPath = join(tmpDir, "package.json");

  const deps: Record<string, string> = {};
  for (const e of entries) {
    deps[e.name] = "*";
  }
  writeFileSync(manifestPath, JSON.stringify({ name: "validation", version: "0.0.0", dependencies: deps }));

  console.log("GROUND TRUTH VALIDATION");
  console.log("========================");
  console.log(`Packages: ${entries.length}`);
  console.log(`Token: ${token ? "yes" : "NO (limited signals)"}`);
  console.log("");
  console.log("Analyzing packages (this may take a few minutes)...\n");

  let report;
  try {
    report = await analyzeHealth({
      manifestPath,
      token,
      noCache: true,
      onProgress: (name) => process.stdout.write(`  ${name}\r`),
    });
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }

  process.stdout.write("\r" + " ".repeat(60) + "\r");

  const resultMap = new Map<string, DependencyHealth>();
  for (const dep of report.dependencies) {
    resultMap.set(dep.name, dep);
  }

  let passed = 0;
  let failed = 0;
  const failures: Array<{ entry: TruthEntry; dep: DependencyHealth }> = [];

  for (const entry of entries) {
    const dep = resultMap.get(entry.name);
    if (!dep) {
      console.log(`❓ MISS  ${entry.name.padEnd(20)} Not found in report`);
      failed++;
      continue;
    }

    const ok = checkPass(entry, dep.grade);
    const expected = expectedLabel(entry);
    const icon = ok ? "✅ PASS" : "❌ FAIL";

    console.log(
      `${icon}  ${dep.name.padEnd(20)} Expected: ${expected.padEnd(6)} Got: ${dep.grade.padEnd(4)} (score: ${dep.score})`,
    );

    if (ok) {
      passed++;
    } else {
      failed++;
      failures.push({ entry, dep });
    }
  }

  console.log("");
  console.log("========================");
  console.log(`RESULTS: ${passed}/${entries.length} correct (${Math.round((passed / entries.length) * 100)}%)`);

  if (failures.length > 0) {
    console.log(`FAILURES: ${failures.length} packages need investigation`);
    console.log("");
    console.log("SIGNAL DUMP FOR FAILURES:");

    for (const { entry, dep } of failures) {
      const commitDate = dep.lastHumanCommit ?? dep.lastCommitDate;
      const commitAge = commitDate
        ? `${Math.floor((Date.now() - new Date(commitDate).getTime()) / (1000 * 60 * 60 * 24 * 30))} months ago`
        : "null";

      console.log(`\n  ${dep.name} [${entry.category}]:`);
      console.log(`    expected: ${expectedLabel(entry)}, got: ${dep.grade} (score ${dep.score})`);
      console.log(`    reason: ${entry.reason}`);
      console.log(`    ---`);
      console.log(`    lastHumanCommit: ${dep.lastHumanCommit ?? "null"} (${commitAge})`);
      console.log(`    lastCommitDate:  ${dep.lastCommitDate ?? "null"}`);
      console.log(`    busFactor:       ${dep.busFactor}`);
      console.log(`    avgIssueResp:    ${dep.avgIssueResponseDays ?? "null"} days`);
      console.log(`    openIssueRatio:  ${dep.openIssueRatio.toFixed(2)}`);
      console.log(`    hasFunding:      ${dep.hasFunding}`);
      console.log(`    downloadTrend:   ${dep.downloadTrend}`);
      console.log(`    weeklyDownloads: ${formatDownloads(dep.weeklyDownloads)}`);
      console.log(`    archived:        ${dep.archived}`);
      console.log(`    deprecated:      ${dep.deprecated ?? "null"}`);
      console.log(`    repoUrl:         ${dep.repoUrl ?? "null"}`);
      console.log(`    error:           ${dep.error ?? "none"}`);
      console.log(`    signals:         ${dep.signals.map((s) => `${s.emoji} ${s.name}: ${s.value}`).join(" | ")}`);

      if (!dep.lastHumanCommit && !dep.lastCommitDate && !dep.repoUrl) {
        console.log(`    → No GitHub repo found. Score based on registry + download data only.`);
      }
      if (dep.avgIssueResponseDays === null) {
        console.log(`    → Issue response data unavailable (null signal — weight redistributed).`);
      }

      const maturityWouldApply =
        dep.weeklyDownloads > 100_000 &&
        dep.downloadTrend !== "declining" &&
        !dep.archived &&
        dep.deprecated === null;
      if (maturityWouldApply && dep.score < 40) {
        console.log(`    → Maturity exception SHOULD apply but didn't — investigate.`);
      }
    }
  }

  console.log("");

  const pct = Math.round((passed / entries.length) * 100);
  if (pct >= 85) {
    console.log(`✅ Accuracy ${pct}% meets the ≥85% target.`);
  } else {
    console.log(`❌ Accuracy ${pct}% is below the 85% target. Scoring needs tuning.`);
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Validation failed:", err);
  process.exit(2);
});
