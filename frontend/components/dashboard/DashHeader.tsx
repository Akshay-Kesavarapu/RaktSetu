'use client'

import Link from 'next/link'

export function DashHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 h-[56px] bg-light-navy text-white flex items-center justify-between px-6 z-50 shadow-sm border-b border-light-navy">
      <div className="flex items-center gap-3">
        <Link href="/" className="font-black text-lg tracking-tight text-white hover:opacity-90 flex items-center gap-2">
          <span className="text-light-accent text-lg leading-none">●</span>
          <span>RaktSetu</span>
        </Link>
        <span className="text-white/40 text-xs border-l border-white/20 pl-3 hidden sm:inline-block font-semibold">
          Impact &amp; Supply Dashboard
        </span>
      </div>
      <div className="flex items-center gap-3">
        <Link 
          href="/"
          className="text-xs font-semibold text-red-200 hover:text-white bg-red-950/40 hover:bg-light-accent px-3 py-1.5 rounded-lg border border-red-800/60 transition-colors"
        >
          Exit Dashboard
        </Link>
      </div>
    </header>
  )
}
