/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{html,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base:    'var(--bg-base)',
        panel:   'var(--bg-panel)',
        hover:   'var(--bg-hover)',
        active:  'var(--bg-active)',
        border:  'var(--border)',
        primary: 'var(--text-primary)',
        muted:   'var(--text-muted)',
        subtle:  'var(--text-subtle)',
        accent:  'var(--accent)',
        surface: 'var(--bg-panel)',
      },
      width: {
        activity: 'var(--activity-w)',
        side:     'var(--side-w)',
        right:    'var(--right-w)',
      },
      height: {
        status: 'var(--status-h)',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
