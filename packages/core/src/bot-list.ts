// NOTE: @Copilot (GitHub Copilot agent) is intentionally NOT in the bot list.
// Copilot agent PRs are human-initiated and represent active maintenance.
// If this changes (e.g., fully autonomous Copilot), revisit this decision.
export const BOT_PATTERNS: RegExp[] = [
  /\[bot\]$/,
  /^dependabot$/i,
  /^renovate$/i,
  /^greenkeeper$/i,
  /^snyk-bot$/i,
  /^imgbot$/i,
  /^allcontributors$/i,
  /^semantic-release-bot$/i,
  /^github-actions$/i,
  /^mergify$/i,
  /^codecov$/i,
  /^stale$/i,
  /^release-please$/i,
  /-bot$/i,
  /^bot-/i,
  /^auto-/i,
];

export const NON_SOURCE_PATHS: RegExp[] = [
  /^\.github\//,
  /^\.circleci\//,
  /^\.travis\.yml$/,
  /^\.gitlab-ci\.yml$/,
  /^Jenkinsfile$/,
  /^\.pre-commit-config/,
  /package-lock\.json$/,
  /yarn\.lock$/,
  /pnpm-lock\.yaml$/,
  /Cargo\.lock$/,
  /Gemfile\.lock$/,
  /poetry\.lock$/,
  /^README/i,
  /^CHANGELOG/i,
  /^LICENSE/i,
  /^CONTRIBUTING/i,
  /^\.gitignore$/,
  /^\.editorconfig$/,
];

export function isBot(login: string): boolean {
  return BOT_PATTERNS.some((p) => p.test(login));
}

export function isSourceFile(filepath: string): boolean {
  return !NON_SOURCE_PATHS.some((p) => p.test(filepath));
}
