import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-manrope)', 'sans-serif'],
        display: ['var(--font-unbounded)', 'var(--font-manrope)', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
          950: '#2e1065',
        },
        magenta: {
          50: '#fff0f6',
          100: '#ffe0ed',
          300: '#ff8fb3',
          400: '#f96694',
          500: '#f23d82',
          600: '#dc2a6c',
          700: '#b81f58',
        },
        amber: {
          50: '#fff8ec',
          100: '#ffefd0',
          300: '#ffd98a',
          400: '#ffc563',
          500: '#ffb23e',
          600: '#e8952a',
          700: '#b8721c',
        },
        stage: {
          DEFAULT: '#150E29',
          2: '#1F1640',
          3: '#291D52',
          border: 'rgba(255,255,255,.08)',
          text: '#F4EEFF',
          muted: '#9C8FC2',
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
export default config;
