/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0A0A0D',
        paper: '#141419',
        line: 'rgba(245,243,238,0.09)',
        cream: '#F5F3EE',
        muted: '#8B8894',
        flame: '#FF6B2C',
      },
      fontFamily: {
        display: ['Unbounded', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
