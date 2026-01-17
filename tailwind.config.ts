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
  				'var(--font-display)',
  				'Playfair Display',
  				'Georgia',
  				'serif'
  			],
  			sans: [
  				'var(--font-sans)',
  				'DM Sans',
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
  					letterSpacing: '-0.02em',
  					fontWeight: '700'
  				}
  			],
  			'display-lg': [
  				'2.75rem',
  				{
  					lineHeight: '1.15',
  					letterSpacing: '-0.02em',
  					fontWeight: '700'
  				}
  			],
  			'display-md': [
  				'2.25rem',
  				{
  					lineHeight: '1.2',
  					letterSpacing: '-0.01em',
  					fontWeight: '600'
  				}
  			]
  		},
  		colors: {
  			burgundy: {
  				'50': '#fdf2f4',
  				'100': '#fce7ea',
  				'200': '#f9d0d8',
  				'300': '#f4a9b8',
  				'400': '#ed7a93',
  				'500': '#e14d6f',
  				'600': '#cc2d55',
  				'700': '#ab2046',
  				'800': '#8f1d3f',
  				'900': '#7a1b3b',
  				'950': '#450a1c'
  			},
  			gold: {
  				'50': '#fdfbe9',
  				'100': '#fcf7c5',
  				'200': '#faed8e',
  				'300': '#f6dc4d',
  				'400': '#f1c91d',
  				'500': '#e1af10',
  				'600': '#c2880b',
  				'700': '#9b620c',
  				'800': '#804e12',
  				'900': '#6d4015',
  				'950': '#402108'
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
  				'200': '#e7e5e4'
  			}
  		},
  		boxShadow: {
  			'warm-sm': '0 1px 2px rgba(122, 27, 59, 0.05)',
  			warm: '0 1px 3px rgba(122, 27, 59, 0.08), 0 1px 2px rgba(122, 27, 59, 0.04)',
  			'warm-md': '0 4px 6px rgba(122, 27, 59, 0.07), 0 2px 4px rgba(122, 27, 59, 0.04)',
  			'warm-lg': '0 10px 15px rgba(122, 27, 59, 0.08), 0 4px 6px rgba(122, 27, 59, 0.04)',
  			gold: '0 4px 14px rgba(241, 201, 29, 0.15)'
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
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
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  plugins: [tailwindcssAnimate],
};

export default config;
