import * as core from "@actions/core";
import * as github from "@actions/github";
import {
  analyzeHealth,
  detectManifest,
  type Grade,
} from "epitaph-dev-core";
import { renderMarkdownReport } from "./reporter/markdown.js";

const GRADE_ORDER: Record<Grade, number> = { A: 5, B: 4, C: 3, D: 2, F: 1 };

async function run(): Promise<void> {
  try {
    const token = core.getInput("github-token");
    const manifestInput = core.getInput("manifest");
    const productionOnly = core.getInput("production-only") === "true";
    const failGrade = (core.getInput("fail-grade") || "D") as Grade;
    const ignoreRaw = core.getInput("ignore");
    const ignore = ignoreRaw
      ? ignoreRaw.split(",").map((s) => s.trim())
      : [];

    let manifestPath = manifestInput;
    if (!manifestPath) {
      const detected = await detectManifest(process.cwd());
      if (!detected) {
        core.setFailed("No manifest file found in repository root.");
        return;
      }
      manifestPath = detected.path;
    }

    core.info(`Scanning ${manifestPath}...`);

    const report = await analyzeHealth({
      manifestPath,
      token,
      productionOnly,
      ignore,
      onProgress: (name) => core.info(`  Analyzing ${name}...`),
    });

    core.setOutput("report", JSON.stringify(report));
    core.setOutput("dead-count", String(report.summary.dead));

    const failThreshold = GRADE_ORDER[failGrade];
    const hasFailures = report.dependencies.some(
      (d) => d.error === null && GRADE_ORDER[d.grade] <= failThreshold,
    );
    core.setOutput("has-failures", String(hasFailures));

    const markdown = renderMarkdownReport(report);

    const context = github.context;
    if (context.payload.pull_request) {
      const octokit = github.getOctokit(token);

      const { data: comments } = await octokit.rest.issues.listComments({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: context.payload.pull_request.number,
      });

      const existingComment = comments.find(
        (c) =>
          c.user?.login === "github-actions[bot]" &&
          c.body?.includes("epitaph — Dependency Health Report"),
      );

      if (existingComment) {
        await octokit.rest.issues.updateComment({
          owner: context.repo.owner,
          repo: context.repo.repo,
          comment_id: existingComment.id,
          body: markdown,
        });
      } else {
        await octokit.rest.issues.createComment({
          owner: context.repo.owner,
          repo: context.repo.repo,
          issue_number: context.payload.pull_request.number,
          body: markdown,
        });
      }
    }

    core.summary.addRaw(markdown);
    await core.summary.write();

    if (hasFailures) {
      const deadDeps = report.dependencies
        .filter((d) => d.error === null && GRADE_ORDER[d.grade] <= failThreshold)
        .map((d) => `${d.name} (${d.grade})`)
        .join(", ");
      core.setFailed(
        `Dependencies below grade ${failGrade}: ${deadDeps}`,
      );
    }
  } catch (err) {
    core.setFailed(err instanceof Error ? err.message : String(err));
  }
}

run();
