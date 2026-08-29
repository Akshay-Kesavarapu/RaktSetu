'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'
import { getStoredBankToken } from '@/lib/api'
import { HelpDrawer } from './HelpDrawer'

export function Header() {
  const pathname = usePathname()
  const [hasBankToken, setHasBankToken] = useState(false)
  const [isHelpOpen, setIsHelpOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const isReportPage = pathname === '/report' || pathname?.startsWith('/report')

  useEffect(() => {
    setHasBankToken(Boolean(getStoredBankToken()))
  }, [pathname])

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [pathname])

  const allNavLinks = [
    { label: 'Search', href: '/search', icon: '🔍' },
    { label: 'Report Stock', href: '/report', icon: '📊' },
    { 
      label: hasBankToken ? 'Bank Portal' : 'Bank Login', 
      href: hasBankToken ? '/bank/portal' : '/bank/login',
      icon: '🏥'
    },
  ]

  const visibleNavLinks = allNavLinks

  return (
    <>
      <header className="fixed top-0 left-0 right-0 h-[56px] bg-light-navy/95 backdrop-blur-md text-white flex items-center justify-between px-4 sm:px-6 z-50 shadow-sm border-b border-white/10 transition-all">
        {/* Brand */}
        <Link 
          href="/" 
          className="flex items-center gap-2 font-black text-base tracking-tight hover:opacity-90 transition-transform active:scale-95 group"
        >
          <span className="text-light-accent text-lg leading-none group-hover:scale-125 transition-transform duration-300">●</span>
          <span className="bg-gradient-to-r from-white via-white to-slate-200 bg-clip-text text-transparent font-black">RaktSetu</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden sm:flex items-center gap-1.5">
          {visibleNavLinks.map(({ label, href }) => {
            const isActive = pathname === href || (href !== '/' && pathname?.startsWith(href))
            return (
              <Link
                key={label}
                href={href}
                className={clsx(
                  'text-xs font-semibold px-3 py-1.5 rounded-lg transition-all duration-200 active:scale-95 relative btn-interactive',
                  isActive
                    ? 'bg-white/15 text-white shadow-xs font-bold'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                )}
              >
                {label}
                {isActive && (
                  <span className="absolute bottom-0.5 left-3 right-3 h-[2px] bg-light-accent rounded-full animate-fadeIn" />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {/* Help & FAQs Drawer Trigger */}
          <button
            type="button"
            onClick={() => setIsHelpOpen(true)}
            className="text-white/85 hover:text-white bg-white/10 hover:bg-white/20 border border-white/20 px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 shadow-2xs btn-interactive"
            aria-label="Open Help & FAQs"
          >
            <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-bold">?</span>
            <span className="hidden xs:inline">Help</span>
          </button>

          {/* Show Admin Login link only on non-report public pages */}
          {!isReportPage && (
            <Link
              href="/dashboard/login"
              className="text-xs font-semibold border border-white/20 text-white/80 hover:text-white hover:border-white/60 hover:bg-white/10 px-2.5 sm:px-3 py-1.5 rounded-lg transition-all active:scale-95 shadow-xs btn-interactive hidden sm:inline-block"
            >
              Admin Login
            </Link>
          )}

          {/* Mobile Menu Hamburger Button */}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="sm:hidden text-white/80 hover:text-white p-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 transition-all active:scale-95"
            aria-label="Toggle navigation menu"
          >
            {isMobileMenuOpen ? (
              <span className="text-sm font-bold w-4 h-4 flex items-center justify-center">✕</span>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* Mobile Collapsible Navigation Overlay */}
      {isMobileMenuOpen && (
        <div className="sm:hidden fixed inset-x-0 top-[56px] z-40 bg-light-navy/98 backdrop-blur-lg border-b border-white/10 p-4 space-y-2 animate-slideUp shadow-xl text-white">
          <div className="space-y-1.5">
            {visibleNavLinks.map(({ label, href, icon }) => {
              const isActive = pathname === href || (href !== '/' && pathname?.startsWith(href))
              return (
                <Link
                  key={label}
                  href={href}
                  className={clsx(
                    'w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95',
                    isActive
                      ? 'bg-light-accent text-white shadow-sm'
                      : 'text-white/80 hover:bg-white/10 hover:text-white'
                  )}
                >
                  <span>{icon}</span>
                  <span>{label}</span>
                </Link>
              )
            })}

            {!isReportPage && (
              <Link
                href="/dashboard/login"
                className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white/80 hover:bg-white/10 border border-white/15 mt-2 transition-all active:scale-95"
              >
                <span>🔒</span>
                <span>Admin Login</span>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Slide-in Help & FAQs Drawer */}
      <HelpDrawer isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </>
  )
}
