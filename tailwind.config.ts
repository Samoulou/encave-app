import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: '1rem',
        sm: '1.5rem',
        lg: '2rem',
        xl: '4rem',
        '2xl': '6rem',
      },
    },
    extend: {
      fontFamily: {
        display: ['var(--font-fraunces)', 'Fraunces', 'Georgia', 'serif'],
        /* Dedicated italic face (Fraunces 400 italic only) — see L-206 */
        'display-italic': [
          'var(--font-fraunces-italic)',
          'Fraunces',
          'Georgia',
          'serif',
        ],
        serif: ['var(--font-fraunces)', 'Fraunces', 'Georgia', 'serif'],
        sans: ['var(--font-manrope)', 'Manrope', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'monospace'],
      },
      fontSize: {
        'display-xl': [
          '2.375rem',
          {
            lineHeight: '2.5rem',
            letterSpacing: '-0.015em',
            fontWeight: '400',
          },
        ],
        'display-lg': [
          '1.625rem',
          {
            lineHeight: '1.9375rem',
            letterSpacing: '-0.015em',
            fontWeight: '600',
          },
        ],
        'display-md': [
          '1.25rem',
          {
            lineHeight: '1.5rem',
            letterSpacing: '-0.01em',
            fontWeight: '600',
          },
        ],
        'display-sm': [
          '1.0625rem',
          {
            lineHeight: '1.3125rem',
            letterSpacing: '-0.01em',
            fontWeight: '600',
          },
        ],
        body: [
          '0.875rem',
          {
            lineHeight: '1.375rem',
            letterSpacing: '0',
            fontWeight: '400',
          },
        ],
        meta: [
          '0.6875rem',
          {
            lineHeight: '0.875rem',
            letterSpacing: '0.06em',
            fontWeight: '500',
          },
        ],
        eyebrow: [
          '0.625rem',
          {
            lineHeight: '0.75rem',
            letterSpacing: '0.14em',
            fontWeight: '600',
          },
        ],
      },
      colors: {
        /* shadcn/ui semantic colors */
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          light: 'hsl(var(--primary-light))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        ring: 'hsl(var(--ring))',
        /* Custom brand colors */
        burgundy: {
          '50': '#fdf2f4',
          '100': '#fbe6ea',
          '200': '#f5c5cf',
          '300': '#f4a9b8',
          '400': '#ed7a93',
          '500': '#e14d6f',
          '600': '#962a48',
          '700': '#7a1b3b',
          '800': '#8f1d3f',
          '900': '#3a0e1f',
          '950': '#450a1c',
        },
        gold: {
          '50': '#f8f1e0',
          '100': '#f5efd9',
          '200': '#e8d9a8',
          '300': '#dcc882',
          '400': '#dcc882',
          '500': '#b8973e',
          '600': '#9d7b30',
          '700': '#a08534',
          '800': '#6a4f26',
          '900': '#5a4324',
          '950': '#332412',
        },
        slate: {
          '50': '#f8fafc',
          '100': '#f1f5f9',
          '200': '#e2e8f0',
          '300': '#cbd5e1',
          '400': '#94a3b8',
          '500': '#64748b',
          '600': '#475569',
          '700': '#334155',
          '800': '#1e293b',
          '900': '#0f172a',
          '950': '#020617',
        },
        cream: {
          '50': '#fdfcfa',
          '100': '#faf7f1',
          '200': '#f3ece0',
        },
        stone: {
          '50': '#f4f1ec',
          '100': '#f5f5f4',
          '200': '#e5d2d7',
          '300': '#c4b8b0',
          '400': '#a89888',
        },
        ink: {
          '300': '#c2a8af',
          '500': '#915564',
          '700': '#3a2429',
          '900': '#1a0f12',
        },
        earth: {
          '400': '#6b5b4f',
          '500': '#5a4d43',
        },
        vine: {
          DEFAULT: '#5a7a3a',
          '400': '#5a6b4a',
          '500': '#4a5a3a',
        },
      },
      transitionTimingFunction: {
        premium: 'cubic-bezier(0.16, 1, 0.3, 1)',
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      boxShadow: {
        'audit-card': '0 2px 10px rgb(60 15 25 / 0.05)',
        'audit-elevated': '0 4px 20px rgb(60 15 25 / 0.06)',
        'audit-sticky':
          '0 -2px 24px rgb(60 15 25 / 0.10), 0 10px 24px rgb(60 15 25 / 0.12)',
        'warm-sm': '0 1px 2px rgba(122, 27, 59, 0.05)',
        warm: '0 1px 3px rgba(122, 27, 59, 0.08), 0 1px 2px rgba(122, 27, 59, 0.04)',
        'warm-md':
          '0 4px 6px rgba(122, 27, 59, 0.07), 0 2px 4px rgba(122, 27, 59, 0.04)',
        'warm-lg':
          '0 10px 15px rgba(122, 27, 59, 0.08), 0 4px 6px rgba(122, 27, 59, 0.04)',
        gold: '0 4px 14px rgba(201, 169, 78, 0.15)',
        card: '0 4px 20px rgba(0, 0, 0, 0.05)',
        'card-hover': '0 12px 30px rgba(150, 42, 72, 0.15)',
        primary: '0 4px 14px rgba(150, 42, 72, 0.2)',
        'warm-xl':
          '0 10px 30px rgba(122, 27, 59, 0.1), 0 4px 10px rgba(0, 0, 0, 0.06)',
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        sm: '0.125rem',
        md: '0.375rem',
        lg: '0.5rem',
        xl: '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
        full: '9999px',
      },
      keyframes: {
        'accordion-down': {
          from: {
            height: '0',
          },
          to: {
            height: 'var(--radix-accordion-content-height)',
          },
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)',
          },
          to: {
            height: '0',
          },
        },
        'shimmer-gold': {
          '0%, 100%': {
            backgroundPosition: '-200% center',
          },
          '50%': {
            backgroundPosition: '200% center',
          },
        },
        'skeleton-shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        /* CSS replacements for framer-motion (L-206) */
        'checkmark-pop': {
          from: { transform: 'scale(0)', opacity: '0' },
          to: { transform: 'scale(1)', opacity: '1' },
        },
        'checkmark-draw': {
          from: { 'stroke-dashoffset': '1', opacity: '0' },
          '1%': { opacity: '1' },
          to: { 'stroke-dashoffset': '0', opacity: '1' },
        },
        'checkmark-glow': {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.3' },
          '50%': { transform: 'scale(1.2)', opacity: '0.5' },
        },
        'progress-grow': {
          from: { width: '0%' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'shimmer-gold': 'shimmer-gold 3s ease-in-out infinite',
        'skeleton-shimmer': 'skeleton-shimmer 1.5s ease-in-out infinite',
        'checkmark-pop':
          'checkmark-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'checkmark-draw':
          'checkmark-draw 0.55s cubic-bezier(0.16, 1, 0.3, 1) 0.3s both',
        'checkmark-glow': 'checkmark-glow 2s ease-in-out infinite',
        'progress-grow':
          'progress-grow 0.5s cubic-bezier(0.16, 1, 0.3, 1) both',
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
