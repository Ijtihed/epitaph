"use client";

import Link from "next/link";

export default function Header() {
  return (
    <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-10 py-4 mix-blend-difference">
      <Link
        href="/"
        className="text-xl font-bold tracking-tighter text-white font-[Manrope] hover:opacity-70 transition-opacity"
      >
        epitaph
      </Link>
      <nav className="hidden md:flex gap-6">
        <a
          href="https://github.com/Ijtihed/epitaph"
          target="_blank"
          rel="noreferrer"
          className="px-3 py-2 text-neutral-500 hover:text-white transition-colors font-[JetBrains_Mono] text-xs uppercase tracking-[0.15em]"
        >
          GitHub
        </a>
        <a
          href="https://www.npmjs.com/package/epitaph-dev"
          target="_blank"
          rel="noreferrer"
          className="px-3 py-2 text-neutral-500 hover:text-white transition-colors font-[JetBrains_Mono] text-xs uppercase tracking-[0.15em]"
        >
          npm
        </a>
        <a
          href="https://github.com/Ijtihed/epitaph#readme"
          target="_blank"
          rel="noreferrer"
          className="px-3 py-2 text-white font-[JetBrains_Mono] text-xs uppercase tracking-[0.15em] hover:opacity-70 transition-opacity"
        >
          Docs
        </a>
      </nav>
    </header>
  );
}
