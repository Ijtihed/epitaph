"use client";

import Header from "@/components/header";
import Footer from "@/components/footer";
import CopyBlock from "@/components/copy-block";

const ACTION_YAML = `name: epitaph
on:
  schedule:
    - cron: '0 9 * * 1'
  pull_request:
    paths: ['package.json']

jobs:
  health:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: Ijtihed/epitaph@v1
        with:
          github-token: \${{ secrets.GITHUB_TOKEN }}
          fail-grade: D
          production-only: true`;

const AI_PROMPT = `Add epitaph to this project. Create .github/workflows/epitaph.yml that runs on every PR using Ijtihed/epitaph@v1. Then run npx epitaph-dev locally and fix any dependency health issues it finds.`;

const SIGNALS = [
  {
    name: "Last human commit",
    weight: "25%",
    desc: "Filters out Dependabot, Renovate, and other bots. Only counts humans touching source files.",
  },
  {
    name: "Bus factor",
    weight: "25%",
    desc: "How many distinct humans committed in the last 12 months. One person = one token away from disaster.",
  },
  {
    name: "Issue responsiveness",
    weight: "20%",
    desc: "Median time for a maintainer to respond. Ignored issues = unpatched bugs.",
  },
  {
    name: "Open issue ratio",
    weight: "15%",
    desc: "Percentage of all issues still open. High ratio = backlog nobody is clearing.",
  },
  {
    name: "Funding",
    weight: "10%",
    desc: "GitHub Sponsors, Open Collective, Tidelift. Funded projects survive maintainer burnout.",
  },
  {
    name: "Download trend",
    weight: "5%",
    desc: "Growing, stable, or declining. Declining downloads = the ecosystem is moving on.",
  },
  {
    name: "Archived",
    weight: "instant F",
    desc: "Repo explicitly marked archived. No PRs, no fixes, no future.",
  },
  {
    name: "Deprecated",
    weight: "instant F",
    desc: "Package marked deprecated on the registry. Maintainer said stop using it.",
  },
];

const COMPETITORS = [
  { tool: "npm audit", does: "Finds known CVEs", missing: "Doesn't know if anyone is around to fix them" },
  { tool: "Snyk Advisor", does: "Health score per package", missing: "Web-only, one at a time, no CLI, no CI" },
  { tool: "Socket.dev", does: "Detects malware", missing: "Enterprise product, not a lightweight dev tool" },
  { tool: "OpenSSF Scorecard", does: "Security posture per repo", missing: "Per-repo, not per-manifest" },
  { tool: "npm outdated", does: "Newer version available?", missing: "Deprecated + no newer version = \"up to date\"" },
];

const TERMINAL_OUTPUT = `  epitaph v0.1.0 — scanning package.json (47 dependencies)

  GRADE  PACKAGE                 SIGNALS
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    F    request                 ⚰️  Deprecated since Feb 2020
    F    event-stream            ⚰️  Archived · supply chain incident
    D    cool-lib                👤 Bus factor: 1 · 14mo since human commit
    C    legacy-helper           👤 Bus factor: 1 · active 2w ago
    B    ms                      📦 Stable (1M+ downloads, no issues)
    A    express                 🟢 12 contributors · funded · active
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  47 scanned · 2 dead · 1 warning · 1 caution · 43 healthy`;

export default function Home() {
  return (
    <>
      <Header />
      <main className="flex-1 flex flex-col">

        {/* Hero */}
        <section className="min-h-dvh flex flex-col items-center justify-center px-6 shrink-0 pt-20 pb-24 md:pt-0 md:pb-32">
          <div className="w-full max-w-2xl mx-auto text-center">
            <h1 className="font-[Manrope] font-extrabold text-[clamp(2.5rem,11vw,8rem)] leading-[0.9] tracking-tighter text-white select-none mb-10">
              epitaph.
            </h1>
            <p className="font-[JetBrains_Mono] text-xs sm:text-sm text-neutral-400 uppercase tracking-[0.25em] mb-4 max-w-md mx-auto">
              your dependencies are dying. epitaph finds the bodies.
            </p>
            <p className="font-[JetBrains_Mono] text-[0.7rem] text-neutral-500 leading-relaxed mb-8 md:mb-10 max-w-lg mx-auto">
              You already audit for CVEs. epitaph audits for abandonment.
              It reads your manifest, checks every package against GitHub and npm,
              and tells you which ones are dead, dying, or on life support.
            </p>
            <a
              href="https://www.npmjs.com/package/epitaph-dev"
              target="_blank"
              rel="noreferrer"
              className="inline-block border border-neutral-700 px-8 py-3 bg-neutral-950 hover:border-neutral-400 hover:bg-neutral-900 transition-all duration-300"
            >
              <code className="font-[JetBrains_Mono] text-base text-white tracking-wider">
                npx epitaph-dev
              </code>
            </a>
            <p className="mt-4 font-[JetBrains_Mono] text-[0.7rem] text-neutral-600 uppercase tracking-[0.15em]">
              run in any project. zero config.
            </p>
          </div>
        </section>

        {/* Terminal preview */}
        <section className="px-4 sm:px-6 pb-16 md:pb-24">
          <div className="max-w-3xl mx-auto">
            <pre className="border border-neutral-800 bg-neutral-950/80 p-5 sm:p-8 overflow-x-auto">
              <code className="font-[JetBrains_Mono] text-[0.7rem] sm:text-[0.8rem] leading-relaxed whitespace-pre text-neutral-400">
                {TERMINAL_OUTPUT}
              </code>
            </pre>
          </div>
        </section>

        {/* How it works */}
        <section className="px-6 py-16 md:py-28">
          <div className="max-w-4xl mx-auto">
            <p className="font-[JetBrains_Mono] text-xs text-neutral-600 uppercase tracking-[0.3em] mb-4 md:mb-6 text-center">
              How it works
            </p>
            <h2 className="font-[Manrope] text-2xl sm:text-3xl md:text-4xl font-light text-white tracking-tight text-center mb-12 md:mb-20">
              One command. Every dependency graded.
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-4">
              <div className="text-center">
                <div className="w-12 h-12 border border-neutral-800 flex items-center justify-center mx-auto mb-5">
                  <span className="font-[Manrope] text-lg font-light text-neutral-500">1</span>
                </div>
                <p className="font-[Manrope] text-base text-white mb-2">Reads your manifest</p>
                <p className="font-[JetBrains_Mono] text-xs text-neutral-500 leading-relaxed max-w-[240px] mx-auto">
                  Parses <span className="text-neutral-300">package.json</span> and extracts every dependency.
                  Production, dev, or both.
                </p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 border border-neutral-800 flex items-center justify-center mx-auto mb-5">
                  <span className="font-[Manrope] text-lg font-light text-neutral-500">2</span>
                </div>
                <p className="font-[Manrope] text-base text-white mb-2">Queries npm + GitHub</p>
                <p className="font-[JetBrains_Mono] text-xs text-neutral-500 leading-relaxed max-w-[240px] mx-auto">
                  Fetches registry data, commit history, issue responsiveness,
                  funding status, and download trends.
                </p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 border border-neutral-800 flex items-center justify-center mx-auto mb-5">
                  <span className="font-[Manrope] text-lg font-light text-neutral-500">3</span>
                </div>
                <p className="font-[Manrope] text-base text-white mb-2">Scores A through F</p>
                <p className="font-[JetBrains_Mono] text-xs text-neutral-500 leading-relaxed max-w-[240px] mx-auto">
                  8 weighted signals. Bot filtering. &quot;Done package&quot; exception.
                  Dead deps flagged, healthy deps confirmed.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* What it checks */}
        <section className="px-4 sm:px-6 py-16 md:py-28">
          <div className="max-w-3xl mx-auto">
            <p className="font-[JetBrains_Mono] text-xs text-neutral-600 uppercase tracking-[0.3em] mb-4 md:mb-6 text-center">
              What it checks
            </p>
            <h2 className="font-[Manrope] text-2xl sm:text-3xl md:text-4xl font-light text-white tracking-tight text-center mb-12 md:mb-16">
              8 signals. Weighted scoring.
            </h2>

            <div className="space-y-0">
              {SIGNALS.map((signal, i) => (
                <div
                  key={signal.name}
                  className="flex items-start gap-4 sm:gap-6 py-5 border-b border-neutral-800/50 last:border-0"
                >
                  <span className="font-[Manrope] text-sm text-neutral-700 tabular-nums shrink-0 pt-0.5 w-5 text-right">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-4 mb-1">
                      <p className="font-[Manrope] text-sm sm:text-base text-white">
                        {signal.name}
                      </p>
                      <span className={`font-[JetBrains_Mono] text-[0.65rem] shrink-0 ${signal.weight === "instant F" ? "text-grade-f" : "text-neutral-600"}`}>
                        {signal.weight}
                      </span>
                    </div>
                    <p className="font-[JetBrains_Mono] text-[0.7rem] sm:text-xs text-neutral-500 leading-relaxed">
                      {signal.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-8 font-[JetBrains_Mono] text-[0.7rem] text-neutral-600 text-center leading-relaxed">
              Packages with &gt;1M weekly downloads and no open issues get a floor score of C.
              <br />
              &quot;Done&quot; packages like <span className="text-neutral-400">ms</span> and <span className="text-neutral-400">inherits</span> aren&apos;t penalized for being finished.
            </p>
          </div>
        </section>

        {/* Divider */}
        <div className="w-16 h-px bg-neutral-800 mx-auto" />

        {/* Why not X */}
        <section className="px-4 sm:px-6 py-16 md:py-28">
          <div className="max-w-3xl mx-auto">
            <p className="font-[JetBrains_Mono] text-xs text-neutral-600 uppercase tracking-[0.3em] mb-4 md:mb-6 text-center">
              Why not X?
            </p>
            <h2 className="font-[Manrope] text-2xl sm:text-3xl md:text-4xl font-light text-white tracking-tight text-center mb-12 md:mb-16">
              Nothing else does this.
            </h2>

            <div className="space-y-0">
              {COMPETITORS.map((c) => (
                <div
                  key={c.tool}
                  className="flex items-start gap-4 sm:gap-6 py-5 border-b border-neutral-800/50 last:border-0"
                >
                  <span className="font-[Manrope] text-sm text-neutral-400 shrink-0 pt-0.5 w-28 sm:w-36">
                    {c.tool}
                  </span>
                  <div className="min-w-0">
                    <p className="font-[JetBrains_Mono] text-xs text-neutral-400 mb-0.5">
                      {c.does}
                    </p>
                    <p className="font-[JetBrains_Mono] text-[0.7rem] text-neutral-600">
                      {c.missing}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Divider */}
        <div className="w-16 h-px bg-neutral-800 mx-auto" />

        {/* Get started */}
        <section className="px-4 sm:px-6 py-16 md:py-28">
          <div className="max-w-5xl mx-auto">
            <p className="font-[JetBrains_Mono] text-xs text-neutral-600 uppercase tracking-[0.3em] mb-4 md:mb-6 text-center">
              Get started
            </p>
            <h2 className="font-[Manrope] text-2xl sm:text-3xl md:text-4xl font-light text-white tracking-tight text-center mb-10 md:mb-20">
              Pick how you want to use it.
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">

              {/* Terminal */}
              <div className="border border-neutral-800 p-5 sm:p-7 flex flex-col">
                <p className="font-[Manrope] text-lg text-white mb-2">Terminal</p>
                <p className="font-[JetBrains_Mono] text-[0.75rem] text-neutral-500 leading-relaxed mb-5">
                  Run once in any project. Nothing to install, nothing to configure.
                </p>
                <div className="mt-auto space-y-3">
                  <CopyBlock code="npx epitaph-dev" lang="bash" />
                  <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
                    <span className="font-[JetBrains_Mono] text-[0.6rem] text-neutral-600">--json</span>
                    <span className="font-[JetBrains_Mono] text-[0.6rem] text-neutral-600">--production-only</span>
                    <span className="font-[JetBrains_Mono] text-[0.6rem] text-neutral-600">--fail-grade D</span>
                  </div>
                </div>
              </div>

              {/* GitHub Action */}
              <div className="border border-neutral-800 p-5 sm:p-7 flex flex-col">
                <p className="font-[Manrope] text-lg text-white mb-2">GitHub Action</p>
                <p className="font-[JetBrains_Mono] text-[0.75rem] text-neutral-500 leading-relaxed mb-5">
                  Add one file. Every PR and weekly schedule gets a health check.
                </p>
                <div className="mt-auto">
                  <CopyBlock code={ACTION_YAML} lang=".github/workflows/epitaph.yml" />
                </div>
              </div>

              {/* AI Prompt */}
              <div className="border border-neutral-800 p-5 sm:p-7 flex flex-col">
                <p className="font-[Manrope] text-lg text-white mb-2">AI Prompt</p>
                <p className="font-[JetBrains_Mono] text-[0.75rem] text-neutral-500 leading-relaxed mb-5">
                  Paste into Cursor, Claude Code, or Copilot. AI does the rest.
                </p>
                <div className="mt-auto">
                  <CopyBlock code={AI_PROMPT} lang="prompt" />
                </div>
              </div>

            </div>
          </div>
        </section>

      </main>
      <Footer />
    </>
  );
}
