'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface HelpDrawerProps {
  isOpen: boolean
  onClose: () => void
}

interface FAQItem {
  id: string
  question: string
  answer: string
}

const FAQS: FAQItem[] = [
  {
    id: 'report-stock',
    question: 'How do I report stock?',
    answer: 'Open the Reporter page, choose "Report via App," select your blood group, component, and quantity, enter your centre\'s ID to verify it\'s you, and submit. It takes under 30 seconds.'
  },
  {
    id: 'offline-sms',
    question: 'What if I have no internet or smartphone?',
    answer: 'Two options. If you have the app but no signal, your update saves automatically and sends itself once you\'re back online — nothing is lost. If you have no smartphone at all, text UPDATE <your centre ID> <blood group> <units> (e.g., UPDATE BB007 APOS 5) to our reporting number — it works exactly the same way.'
  },
  {
    id: 'correct-update',
    question: 'I made a mistake in my last update — can I fix it?',
    answer: 'Yes, within 24 hours. Go to "Correct Previous Update," enter the reference ID shown after your original submission, and update it. The original stays on record for transparency, but your correction becomes the current value.'
  },
  {
    id: 'request-blood',
    question: 'How do I request blood from another centre in an emergency?',
    answer: 'Log in through "Bank Login" using your centre ID, then use "Request Blood" on your portal to send a request to any other registered centre — they\'ll be notified the next time they log in.'
  },
  {
    id: 'search-near-me',
    question: 'How do I find blood near me?',
    answer: 'Go to "Search Inventory," select the blood group and component you need, enter your location, and you\'ll see nearby centres with current stock and how recently it was updated.'
  },
  {
    id: 'accuracy-guarantee',
    question: 'Is this stock information guaranteed to be accurate?',
    answer: 'We show the most recent report from each centre, but always call ahead to confirm before travelling — availability can change quickly in an emergency.'
  }
]

export function HelpDrawer({ isOpen, onClose }: HelpDrawerProps) {
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({})

  // Toggle individual accordion items
  const toggleItem = (id: string) => {
    setOpenItems((prev) => ({
      ...prev,
      [id]: !prev[id]
    }))
  }

  // Handle escape key and scroll lock
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    if (isOpen) {
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', handleKeyDown)
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  return (
    <div
      className={`fixed inset-0 z-[100] transition-visibility duration-300 ${
        isOpen ? 'visible' : 'invisible'
      }`}
      aria-hidden={!isOpen}
    >
      {/* Backdrop overlay */}
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-light-navy/60 backdrop-blur-xs transition-opacity duration-300 ease-out ${
          isOpen ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Slide-in Drawer container */}
      <aside
        className={`fixed inset-y-0 right-0 z-10 w-full sm:max-w-lg md:max-w-xl bg-[#FAFAFA] shadow-2xl flex flex-col transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Sticky Fixed Header */}
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-red-50 text-light-accent border border-red-100 flex items-center justify-center font-bold text-sm">
              ?
            </span>
            <div>
              <h2 className="text-base font-black text-light-navy tracking-tight">
                Help &amp; FAQs
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                Frequently Asked Questions &amp; System Guides
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Help panel"
            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-light-navy transition-colors flex items-center justify-center font-bold text-sm active:scale-95"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-6 space-y-4">
          <div className="space-y-3.5">
            {FAQS.map((faq) => {
              const isExpanded = Boolean(openItems[faq.id])
              return (
                <div
                  key={faq.id}
                  className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs hover:border-slate-300 transition-all duration-200"
                >
                  <button
                    type="button"
                    onClick={() => toggleItem(faq.id)}
                    className={`w-full text-left px-5 py-4 text-sm sm:text-base font-bold transition-all flex items-center justify-between gap-3 ${
                      isExpanded
                        ? 'bg-red-50/70 text-light-accent'
                        : 'text-light-navy hover:text-light-accent hover:bg-slate-50/60'
                    }`}
                  >
                    <span className="leading-snug">{faq.question}</span>
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 transition-transform duration-200 ${
                        isExpanded 
                          ? 'rotate-180 bg-light-accent text-white' 
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      ▼
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="px-5 py-4 text-xs sm:text-sm text-slate-700 bg-white border-t border-slate-100 leading-relaxed animate-fadeIn">
                      {faq.answer}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Quick Actions Footer */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 mt-6 shadow-xs">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
              Quick Shortcuts
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <Link
                href="/search"
                onClick={onClose}
                className="bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl p-3 text-center text-xs font-bold text-light-navy transition-all active:scale-95 shadow-2xs flex items-center justify-center gap-1.5"
              >
                <span>🔍</span>
                <span>Search Inventory</span>
              </Link>
              <Link
                href="/report"
                onClick={onClose}
                className="bg-light-accent hover:bg-red-700 text-white rounded-xl p-3 text-center text-xs font-bold transition-all active:scale-95 shadow-xs flex items-center justify-center gap-1.5"
              >
                <span>📊</span>
                <span>Report Stock</span>
              </Link>
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}
