/** @type {import('tailwindcss').Config} */
module.exports = {
  // Scan the landing HTML. Tailwind v3 resolves content globs relative to the
  // CWD the CLI is run from (the project root), so point straight at public/.
  content: ['./public/landing.html'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Manrope', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: '#1971C2',
          light: '#228be6',
          dark: '#1864AB',
        },
        bg: '#FAFBFD',
        graphite: {
          900: '#1a1d20',
          800: '#2d3136',
          600: '#4a5056',
        },
      },
      boxShadow: {
        soft: '0 10px 40px -10px rgba(0,0,0,0.05)',
        glow: '0 0 20px rgba(25, 113, 194, 0.3)',
      },
    },
  },
  plugins: [],
};
