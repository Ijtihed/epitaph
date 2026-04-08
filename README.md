<div align="center">

<h1>epitaph.</h1>
<h3><em>Your dependencies are dying. epitaph finds the bodies.</em></h3>

<p>
  <a href="https://epitaph.vercel.app"><img src="https://img.shields.io/badge/Website-epitaph.vercel.app-000000?style=for-the-badge" alt="Website"></a>
  <a href="https://www.npmjs.com/package/epitaph-dev"><img src="https://img.shields.io/badge/npx-epitaph--dev-cb3837?style=for-the-badge&logo=npm&logoColor=white" alt="npx epitaph-dev"></a>
  <a href="https://github.com/Ijtihed/epitaph"><img src="https://img.shields.io/badge/Signals-8-8a9bb5?style=for-the-badge" alt="8 Signals"></a>
  <a href="https://github.com/Ijtihed/epitaph"><img src="https://img.shields.io/badge/Built_with-TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="Built with TypeScript"></a>
  <a href="https://github.com/Ijtihed/epitaph"><img src="https://img.shields.io/badge/Runtime-Node_18+-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node 18+"></a>
  <a href="https://github.com/Ijtihed/epitaph/blob/master/LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="MIT License"></a>
</p>

</div>

---

> You already audit for CVEs. epitaph audits for abandonment. It reads your dependency manifest, checks every package against GitHub and npm, and tells you which ones are dead, dying, or on life support. Bus factor 1, last human commit 14 months ago, maintainer account hijacked — if your supply chain has a weak link, epitaph finds it.

---

## Quick Start

```bash
npx epitaph-dev
```

Run in any project with a `package.json`. Zero config. Scans every dependency and grades it A through F.

## How It Works

1. **Reads your manifest** — parses `package.json` and extracts every dependency
2. **Queries npm + GitHub** — fetches registry data, commit history, issue responsiveness, funding, download trends
3. **Filters the noise** — excludes bot commits (Dependabot, Renovate, etc.) and non-source changes (lockfiles, CI configs, READMEs)
4. **Scores and grades** — computes a 0–100 score across 8 weighted signals, assigns A/B/C/D/F

```
$ npx epitaph-dev

  epitaph v0.1.0 — scanning package.json (47 dependencies)

  GRADE  PACKAGE                 SIGNALS
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    F    request                 ⚰️  Deprecated since Feb 2020
    F    event-stream            ⚰️  Archived · known supply chain incident
    D    cool-lib                👤  Bus factor: 1 · last human commit: 14mo ago
    C    legacy-helper           👤  Bus factor: 1 · active 2w ago
    B    ms                      📦  Stable (1M+ downloads, no issues)
    A    express                 🟢  12 contributors · funded · active
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  47 scanned · 2 dead · 1 warning · 1 caution · 43 healthy
```

## What It Checks

| Signal | Weight | What it catches |
|--------|--------|----------------|
| **Last human commit** | 25% | Bot activity inflates "last commit." epitaph filters Dependabot/Renovate and only counts humans touching source files. |
| **Bus factor** | 25% | How many distinct humans committed in the last 12 months? One person = one compromised token away from disaster. |
| **Issue responsiveness** | 20% | Median time for a maintainer to respond to issues. Ignored issues = unpatched bugs. |
| **Open issue ratio** | 15% | What percentage of all issues are still open? High ratio = backlog nobody's clearing. |
| **Funding** | 10% | GitHub Sponsors, Open Collective, Tidelift. Funded projects survive maintainer burnout. |
| **Download trend** | 5% | Growing, stable, or declining? Declining downloads signal the ecosystem is moving on. |
| **Archived** | instant F | Repo explicitly marked archived. No PRs, no fixes, no future. |
| **Deprecated** | instant F | Package marked deprecated on the registry. |

## "Done Package" Exception

Packages like `ms` or `inherits` haven't been updated in years — because they're *finished*, not abandoned. If a package has >1M weekly downloads, no open security issues, and stable/growing usage, epitaph floors the score at C instead of failing it.

## GitHub Action

Create `.github/workflows/epitaph.yml`:

```yaml
name: epitaph
on:
  schedule:
    - cron: '0 9 * * 1'  # Monday 9am
  pull_request:
    paths: ['package.json']

jobs:
  health:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: Ijtihed/epitaph@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          fail-grade: D
          production-only: true
```

Posts a markdown table as a PR comment on manifest changes. Opens an issue on the weekly schedule if new dead deps are found.

## Configuration

Create `.epitaphrc.json` or run `npx epitaph-dev init`:

```json
{
  "manifests": ["package.json"],
  "ignore": ["@types/*", "typescript", "prettier", "eslint"],
  "production-only": true,
  "fail-grade": "D",
  "cache-ttl": 24
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `manifests` | `string[]` | auto-detect | Manifest files to scan |
| `ignore` | `string[]` | `[]` | Packages to skip (glob patterns supported) |
| `production-only` | `boolean` | `false` | Skip devDependencies |
| `fail-grade` | `string` | `"D"` | Grade threshold for CI failure |
| `weights` | `object` | see above | Custom scoring weights (must sum to 100) |
| `cache-ttl` | `number` | `24` | Cache TTL in hours (0 to disable) |

## CLI Reference

```
epitaph [command] [options]

Commands:
  scan [default]         Scan dependency manifest for maintenance health
  init                   Generate .epitaphrc.json with smart defaults
  explain <package>      Deep-dive into one dependency's health signals

Options:
  -m, --manifest <path>  Path to manifest file (auto-detected if omitted)
  -t, --token <token>    GitHub personal access token
  -p, --production-only  Only scan production dependencies
  -j, --json             Output as JSON
  -v, --verbose          Show errors and extra details
  --ignore <packages>    Packages to ignore
  --fail-grade <grade>   Exit 1 if any dep scores at or below this grade
  --no-cache             Skip disk cache (fetch fresh data)
  --help                 Show help
  --version              Show version
```

## Why Not X?

| Tool | What it does | What it doesn't do |
|------|--------------|-------------------|
| **npm audit** | Finds known CVEs | Doesn't know if anyone is around to fix them |
| **Snyk Advisor** | Health score per package | Web-only, one at a time, no CLI, no CI |
| **Socket.dev** | Detects malware + typosquatting | Enterprise product, not a lightweight dev tool |
| **OpenSSF Scorecard** | Security posture per repo | Per-repo, not per-manifest. Doesn't batch-scan your deps. |
| **npm outdated** | Newer version available? | Deprecated package with no newer version shows "up to date" |
| **depcheck** | Unused deps? | No health data, no repo analysis |

**epitaph is the first tool that reads your manifest and tells you which dependencies are dying.** One command, all your deps, maintenance health grades.

## Let AI Set It Up

Paste into Cursor, Claude Code, or Copilot inside your project:

```
Add epitaph to this project. Create .github/workflows/epitaph.yml that runs
on every PR using Ijtihed/epitaph@v1. Then run npx epitaph-dev locally and
fix any dependency health issues it finds.
```

## License

[MIT](LICENSE)

---

<div align="center">
<sub>Built by <a href="https://github.com/Ijtihed">Ijtihed</a></sub>
</div>
