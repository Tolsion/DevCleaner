/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        canvas: '#0f172a',
        surface: '#111827',
        accent: '#38bdf8',
        muted: '#94a3b8'
      }
    }
  },
  plugins: []
};
