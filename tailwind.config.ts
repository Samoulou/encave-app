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
  			'2xl': '6rem'
  		}
  	},
  	extend: {
  		fontFamily: {
  			display: [
  				'var(--font-fraunces)',
  				'Fraunces',
  				'Georgia',
  				'serif'
  			],
  			serif: [
  				'var(--font-fraunces)',
  				'Fraunces',
  				'Georgia',
  				'serif'
  			],
  			sans: [
  				'var(--font-manrope)',
  				'Manrope',
  				'system-ui',
  				'sans-serif'
  			],
  			mono: [
  				'var(--font-mono)',
  				'JetBrains Mono',
  				'monospace'
  			]
  		},
  		fontSize: {
  			'display-xl': [
  				'3.5rem',
  				{
  					lineHeight: '1.1',
  					letterSpacing: '-0.01em',
  					fontWeight: '700'
  				}
  			],
  			'display-lg': [
  				'2.75rem',
  				{
  					lineHeight: '1.15',
  					letterSpacing: '-0.01em',
  					fontWeight: '700'
  				}
  			],
  			'display-md': [
  				'2.25rem',
  				{
  					lineHeight: '1.2',
  					letterSpacing: '-0.005em',
  					fontWeight: '600'
  				}
  			]
  		},
  		colors: {
  			/* shadcn/ui semantic colors */
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))',
  				light: 'hsl(var(--primary-light))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			ring: 'hsl(var(--ring))',
  			/* Custom brand colors */
  			burgundy: {
  				'50': '#fdf2f4',
  				'100': '#fce7ea',
  				'200': '#f9d0d8',
  				'300': '#f4a9b8',
  				'400': '#ed7a93',
  				'500': '#e14d6f',
  				'600': '#962a48',
  				'700': '#732040',
  				'800': '#8f1d3f',
  				'900': '#7a1b3b',
  				'950': '#450a1c'
  			},
  			gold: {
  				'50': '#fbf8f0',
  				'100': '#f5efd9',
  				'200': '#ebddb3',
  				'300': '#dcc882',
  				'400': '#c9a94e',
  				'500': '#b8973e',
  				'600': '#9d7b30',
  				'700': '#7f6028',
  				'800': '#6a4f26',
  				'900': '#5a4324',
  				'950': '#332412'
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
  				'950': '#020617'
  			},
  			cream: {
  				'50': '#fdfcfa',
  				'100': '#faf8f5',
  				'200': '#f5f2ed'
  			},
  			stone: {
  				'100': '#f5f5f4',
  				'200': '#e7e5e4',
  				'300': '#c4b8b0',
  				'400': '#a89888'
  			},
  			earth: {
  				'400': '#6b5b4f',
  				'500': '#5a4d43'
  			},
  			vine: {
  				'400': '#5a6b4a',
  				'500': '#4a5a3a'
  			}
  		},
  		transitionTimingFunction: {
  			premium: 'cubic-bezier(0.16, 1, 0.3, 1)',
  			spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
  		},
  		boxShadow: {
  			'warm-sm': '0 1px 2px rgba(122, 27, 59, 0.05)',
  			warm: '0 1px 3px rgba(122, 27, 59, 0.08), 0 1px 2px rgba(122, 27, 59, 0.04)',
  			'warm-md': '0 4px 6px rgba(122, 27, 59, 0.07), 0 2px 4px rgba(122, 27, 59, 0.04)',
  			'warm-lg': '0 10px 15px rgba(122, 27, 59, 0.08), 0 4px 6px rgba(122, 27, 59, 0.04)',
  			gold: '0 4px 14px rgba(201, 169, 78, 0.15)',
  			card: '0 4px 20px rgba(0, 0, 0, 0.05)',
  			'card-hover': '0 12px 30px rgba(150, 42, 72, 0.15)',
  			primary: '0 4px 14px rgba(150, 42, 72, 0.2)',
  			'warm-xl': '0 10px 30px rgba(122, 27, 59, 0.1), 0 4px 10px rgba(0, 0, 0, 0.06)'
  		},
  		borderRadius: {
  			DEFAULT: '0.25rem',
  			sm: '0.125rem',
  			md: '0.375rem',
  			lg: '0.5rem',
  			xl: '0.75rem',
  			'2xl': '1rem',
  			'3xl': '1.5rem',
  			full: '9999px'
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			},
  			'shimmer-gold': {
  				'0%, 100%': {
  					backgroundPosition: '-200% center'
  				},
  				'50%': {
  					backgroundPosition: '200% center'
  				}
  			},
  			'skeleton-shimmer': {
  				'0%': { backgroundPosition: '-200% 0' },
  				'100%': { backgroundPosition: '200% 0' }
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
  			'shimmer-gold': 'shimmer-gold 3s ease-in-out infinite',
			'skeleton-shimmer': 'skeleton-shimmer 1.5s ease-in-out infinite'
  		}
  	}
  },
  plugins: [tailwindcssAnimate],
};

export default config;
