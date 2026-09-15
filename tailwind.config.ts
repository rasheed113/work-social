import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ws: {
          deep: 'var(--ws-bg-start)',
          space: 'var(--ws-bg-end)',
          cyan: 'var(--ws-cyan)',
          blue: 'var(--ws-blue)',
          alert: 'var(--ws-alert)',
          orange: 'var(--ws-orange)',
          text: {
            primary: 'var(--ws-text-primary)',
            cyan: 'var(--ws-text-cyan)',
            muted: 'var(--ws-text-muted)',
          },
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        hud: ['Orbitron', 'Roboto Mono', 'monospace'],
        mono: ['Roboto Mono', 'monospace'],
      },
      borderRadius: {
        'ws-sm': 'var(--ws-radius-sm)',
        'ws-md': 'var(--ws-radius-md)',
        'ws-lg': 'var(--ws-radius-lg)',
        'ws-xl': 'var(--ws-radius-xl)',
      },
      backdropBlur: {
        ws: 'var(--ws-glass-blur)',
      },
      boxShadow: {
        'ws-cyan': 'var(--ws-glow-cyan)',
        'ws-cyan-hover': 'var(--ws-glow-cyan-hover)',
        'ws-blue': 'var(--ws-glow-blue)',
        'ws-alert': 'var(--ws-glow-alert)',
      },
    },
  },
  plugins: [],
}

export default config
