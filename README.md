<div align="center">

<h1>epitaph.</h1>
<h3><em>Your dependencies are dying. epitaph finds the bodies.</em></h3>

<p>
  <a href="https://epitaph-dev.vercel.app"><img src="https://img.shields.io/badge/Website-epitaph--dev.vercel.app-000000?style=for-the-badge" alt="Website"></a>
  <a href="https://www.npmjs.com/package/epitaph-dev"><img src="https://img.shields.io/badge/npx-epitaph--dev-cb3837?style=for-the-badge&logo=npm&logoColor=white" alt="npx epitaph-dev"></a>
  <a href="https://github.com/Ijtihed/epitaph"><img src="https://img.shields.io/badge/Signals-8-8a9bb5?style=for-the-badge" alt="8 Signals"></a>
  <a href="https://github.com/Ijtihed/epitaph"><img src="https://img.shields.io/badge/Built_with-TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="Built with TypeScript"></a>
  <a href="https://github.com/Ijtihed/epitaph"><img src="https://img.shields.io/badge/Runtime-Node_18+-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node 18+"></a>
  <a href="https://github.com/Ijtihed/epitaph/blob/master/LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="MIT License"></a>
</p>

</div>

---

> You already audit for CVEs. epitaph audits for abandonment. It reads your `package.json`, checks every dependency against GitHub and npm, and grades each one A through F based on real maintenance signals — last human commit, contributor count, issue response time, funding, and download trends. Bus factor 1, last human commit 14 months ago, maintainer account hijacked — epitaph finds it before it becomes your problem.

---

## Quick Start

```bash
npx epitaph-dev
```

Run in any project with a `package.json`. No install, no config. Results in seconds.

```
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

---

## GitHub Token (Recommended)

Without a token, epitaph uses npm data only — download counts and registry info. That's enough to catch deprecated and archived packages.

**With a token, you get the full picture:** commit history, bus factor, issue response times, and funding data. This is what powers the D/C grades that catch slow-dying packages before they become a problem.

### Option 1 — Pass it inline

```bash
npx epitaph-dev --token YOUR_GITHUB_TOKEN
```

### Option 2 — Set it as an environment variable (recommended)

```bash
# Add to your shell profile (~/.bashrc, ~/.zshrc, etc.)
export GITHUB_TOKEN=YOUR_GITHUB_TOKEN
```

Then just run `npx epitaph-dev` — it picks it up automatically every time.

### How to create a token

1. Go to [github.com/settings/tokens](https://github.com/settings/tokens)
2. Click **Generate new token (classic)**
3. Give it a name like `epitaph`
4. Select scope: **`public_repo`** (read-only access to public repos — that's all epitaph needs)
5. Copy the token and set it as `GITHUB_TOKEN`

> epitaph only reads public repository data. It never writes anything to GitHub.

---

## How It Works

1. **Reads your manifest** — parses `package.json` and collects all `dependencies` and `devDependencies`
2. **Resolves each package** — fetches registry metadata from npm to get the repo URL, version history, and deprecation status
3. **Queries GitHub** — for each package with a GitHub repo, fetches the last 12 months of commits (filtering out bots and non-source changes), open/closed issues, contributor list, and funding info
4. **Fetches download trends** — pulls weekly download counts from the npm downloads API and computes whether each package is growing, stable, or declining
5. **Scores 0–100** — computes a weighted score across 8 signals (see below), with special handling for "done" packages that are finished but not dead
6. **Grades A–F** — maps the score to a letter grade and surfaces the most relevant signals as human-readable output

---

## What the Grades Mean

| Grade | Score | Meaning |
|-------|-------|---------|
| **A** | 80–100 | Actively maintained. Multiple contributors, responsive, funded or widely used. |
| **B** | 60–79 | Healthy. Recent activity, reasonable contributor count, no red flags. |
| **C** | 40–59 | Stable but aging. Low activity or single maintainer, but still functional. |
| **D** | 20–39 | At risk. Infrequent commits, bus factor 1, slow or no issue response. |
| **F** | 0–19 | Dead, deprecated, archived, or compromised. Do not depend on this. |

---

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

### "Done Package" Exception

Packages like `ms` or `inherits` haven't been updated in years — because they're *finished*, not abandoned. If a package has >1M weekly downloads and stable/growing usage, epitaph floors the score at C instead of failing it. Finished is not the same as dead.

---

## GitHub Action

Add epitaph to your CI in one file. It runs on every PR that touches `package.json` and on a weekly schedule.

Create `.github/workflows/epitaph.yml`:

```yaml
name: epitaph
on:
  schedule:
    - cron: '0 9 * * 1'  # every Monday 9am
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

**No setup required.** `${{ secrets.GITHUB_TOKEN }}` is automatically provided by GitHub on every workflow run — you don't create or store any token yourself.

What this does:
- On every PR that modifies `package.json` — posts a health report as a PR comment and fails the check if any dependency scores D or below
- Every Monday morning — opens an issue if any dependency has gone stale since your last PR

---

## Configuration

Create `.epitaphrc.json` in your project root, or run `npx epitaph-dev init` to generate one:

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

---

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

---

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

---

## Let AI Set It Up

Paste into Cursor, Claude Code, or Copilot inside your project:

```
Add epitaph to this project. Create .github/workflows/epitaph.yml that runs
on every PR using Ijtihed/epitaph@v1. Then run npx epitaph-dev locally and
fix any dependency health issues it finds.
```

---

## License

[MIT](LICENSE)

---

<div align="center">
<sub>Built by <a href="https://github.com/Ijtihed">Ijtihed</a></sub>
</div>
