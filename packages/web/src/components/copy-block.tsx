"use client";

import { useState } from "react";

interface CopyBlockProps {
  code: string;
  lang?: string;
}

export default function CopyBlock({ code, lang }: CopyBlockProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="relative group">
      <button
        onClick={handleCopy}
        className="absolute top-3 right-3 p-1.5 border border-neutral-800 bg-black/50 text-neutral-500 hover:text-white hover:border-neutral-600 transition-all duration-200 opacity-0 group-hover:opacity-100 focus:opacity-100"
        aria-label="Copy to clipboard"
      >
        {copied ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        )}
      </button>
      {lang && (
        <span className="absolute top-3 left-4 font-[JetBrains_Mono] text-[0.6rem] text-neutral-600 uppercase tracking-wider select-none">
          {lang}
        </span>
      )}
      <pre className="border border-neutral-800 bg-neutral-950/50 p-4 pt-8 overflow-x-auto">
        <code className="font-[JetBrains_Mono] text-[0.8rem] text-neutral-300 leading-relaxed whitespace-pre-wrap">
          {code}
        </code>
      </pre>
    </div>
  );
}
