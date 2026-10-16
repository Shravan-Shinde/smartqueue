/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        sq: {
          bg: '#F9FCFB',
          surface: '#FFFFFF',
          surfaceSecondary: '#F2F8F6',
          primary: '#23796E',
          primaryDark: '#195F56',
          primarySubtle: '#CBF5EF',
          primaryBorder: '#A9E7DC',
          textPrimary: '#263533',
          textSecondary: '#687875',
          muted: '#879590',
          border: '#E2EBE8',
          borderStrong: '#CFDEDA',
          success: '#21865B',
          successBg: '#EAF7EF',
          warning: '#B7791F',
          warningBg: '#FFF6E5',
          danger: '#C74646',
          dangerBg: '#FCEEEE',
          info: '#287D91',
          infoBg: '#EAF6F8',
          accentCoral: '#E89A83',
          focusRing: '#23796E',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'sq-soft': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
      },
      borderRadius: {
        '2xl': '0.75rem',
        '3xl': '1rem',
      },
    },
  },
  plugins: [],
};
