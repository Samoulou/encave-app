import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // EnCave brand colors
        burgundy: {
          50: '#fdf2f4',
          100: '#fce7ea',
          200: '#f9d0d8',
          300: '#f4a9b8',
          400: '#ed7a93',
          500: '#e14d6f',
          600: '#cc2d55',
          700: '#ab2046',
          800: '#8f1d3f',
          900: '#7a1b3b',
          950: '#450a1c',
        },
        gold: {
          50: '#fdfbe9',
          100: '#fcf7c5',
          200: '#faed8e',
          300: '#f6dc4d',
          400: '#f1c91d',
          500: '#e1af10',
          600: '#c2880b',
          700: '#9b620c',
          800: '#804e12',
          900: '#6d4015',
          950: '#402108',
        },
        slate: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [],
};

export default config;
