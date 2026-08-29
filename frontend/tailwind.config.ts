import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Theme 1 — Light (public pages)
        'light-bg': '#FAFAFA',
        'light-surface': '#FFFFFF',
        'light-accent': '#B3261E',
        'light-navy': '#0B1F3A',
        'light-body': '#1A1A1A',
        'light-muted': '#6B7280',
        'light-border': '#E5E7EB',
        'light-success': '#1D8348',
        // Theme 2 — Dark (dashboard only)
        'dash-bg': '#0D1117',
        'dash-surface': '#161B22',
        'dash-text': '#E6EDF3',
        'dash-muted': '#8B949E',
        'dash-active': '#2EA043',
        'dash-stale': '#DA3633',
        'dash-accent': '#F0883E',
        'dash-border': '#30363D',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        // Override to keep clinical aesthetic
        DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.08)',
        sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        md: '0 2px 4px 0 rgb(0 0 0 / 0.07)',
      },
    },
  },
  plugins: [],
}
export default config
