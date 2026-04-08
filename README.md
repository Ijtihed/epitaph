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

> You already audit for CVEs. epitaph audits for abandonment. It reads your `package.json`, queries GitHub and npm, and grades every dependency A through F based on real maintenance signals. Bus factor 1, last human commit 14 months ago, maintainer account hijacked: epitaph finds it before it becomes your problem.

## Quick Start

```bash
npx epitaph-dev
```

Run in any project with a `package.json`. No install, no config. Results in seconds.

```
  epitaph v0.1.0 -- scanning package.json (47 dependencies)

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

## GitHub Token

Without a token, epitaph catches deprecated and archived packages using npm data only.
With a token, you get commit history, bus factor, issue response times, and funding data. That is what powers the D and C grades.

**Set as env var (recommended):**

```bash
export GITHUB_TOKEN=your_token   # add to ~/.bashrc or ~/.zshrc
```

**Or pass inline:**

```bash
npx epitaph-dev --token YOUR_TOKEN
```

**To create a token:**

1. Go to [github.com/settings/tokens](https://github.com/settings/tokens)
2. Click **Generate new token (classic)**
3. Give it a name like `epitaph`
4. Select scope: **`public_repo`** (read-only access to public repos)
5. Copy the token and set it as `GITHUB_TOKEN`

epitaph only reads public repository data. It never writes anything to GitHub.

---

## Grades

| Grade | Score | Meaning |
|-------|-------|---------|
| **A** | 80-100 | Actively maintained. Multiple contributors, responsive, funded or widely used. |
| **B** | 60-79 | Healthy. Recent activity, reasonable contributor count, no red flags. |
| **C** | 40-59 | Stable but aging. Low activity or single maintainer, still functional. |
| **D** | 20-39 | At risk. Infrequent commits, bus factor 1, slow or no issue response. |
| **F** | 0-19 | Dead, deprecated, archived, or compromised. Do not depend on this. |

---

## Signals

| Signal | Weight | What it catches |
|--------|--------|----------------|
| Last human commit | 25% | Bot activity inflates "last commit." epitaph filters Dependabot/Renovate and only counts humans touching source files. |
| Bus factor | 25% | How many distinct humans committed in the last 12 months. One person = one compromised token away from disaster. |
| Issue responsiveness | 20% | Median time for a maintainer to respond. Ignored issues = unpatched bugs. |
| Open issue ratio | 15% | What percentage of all issues are still open. High ratio = backlog nobody is clearing. |
| Funding | 10% | GitHub Sponsors, Open Collective, Tidelift. Funded projects survive maintainer burnout. |
| Download trend | 5% | Growing, stable, or declining. Declining downloads signal the ecosystem is moving on. |
| Archived | instant F | Repo explicitly marked archived. No PRs, no fixes, no future. |
| Deprecated | instant F | Package marked deprecated on the registry. |

Packages like `ms` or `inherits` have not been updated in years because they are *finished*, not abandoned. If a package has more than 1M weekly downloads and stable usage, epitaph floors the score at C. Finished is not the same as dead.

---

## GitHub Action

Add to your CI in one file. Runs on every PR that touches `package.json` and on a weekly schedule.

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

`secrets.GITHUB_TOKEN` is automatically provided by GitHub on every workflow run. No token setup required.

---

## Configuration

Create `.epitaphrc.json` in your project root, or run `npx epitaph-dev init` to generate one:

```json
{
  "ignore": ["@types/*", "typescript", "prettier", "eslint"],
  "production-only": true,
  "fail-grade": "D",
  "cache-ttl": 24
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `manifests` | auto-detect | Manifest files to scan |
| `ignore` | `[]` | Packages to skip (glob patterns) |
| `production-only` | `false` | Skip devDependencies |
| `fail-grade` | `"D"` | Grade threshold for CI failure |
| `weights` | see signals | Custom scoring weights (must sum to 100) |
| `cache-ttl` | `24` | Cache TTL in hours (0 to disable) |

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
```

---

## Why Not X?

| Tool | What it does | What it misses |
|------|--------------|----------------|
| **npm audit** | Finds known CVEs | Does not know if anyone is around to fix them |
| **Snyk Advisor** | Health score per package | Web-only, one at a time, no CLI, no CI |
| **Socket.dev** | Detects malware + typosquatting | Enterprise product, not a lightweight dev tool |
| **npm outdated** | Newer version available? | Deprecated package with no newer version shows "up to date" |

epitaph is the only tool that reads your manifest and grades every dependency for maintenance health.

---

## Let AI Set It Up

Paste into Cursor, Claude Code, or Copilot inside your project:

```
Add epitaph to this project. Create .github/workflows/epitaph.yml that runs
on every PR using Ijtihed/epitaph@v1. Then run npx epitaph-dev locally and
fix any dependency health issues it finds.
```

---

[MIT](LICENSE) &nbsp;·&nbsp; Built by [Ijtihed](https://github.com/Ijtihed)
