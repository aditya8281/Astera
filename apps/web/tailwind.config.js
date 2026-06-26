/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'bg-deep': '#0a0a0f',
        'bg-surface': '#111118',
        'bg-card': '#1a1a24',
        'border-subtle': '#2a2a3a',
        'accent-cyan': '#06b6d4',
        'accent-violet': '#8b5cf6',
        'accent-emerald': '#10b981',
        'accent-amber': '#f59e0b',
        'accent-rose': '#f43f5e',
        'text-primary': '#e8e8f0',
        'text-muted': '#9ca3af',
      },
    },
  },
  plugins: [],
}
