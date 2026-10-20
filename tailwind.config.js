/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        palmiye: {
          50: '#f0fdf4',
          100: '#dcfce7',
          500: '#10b981', // Palmiye Yeşil Vurgusu
          600: '#059669',
          800: '#065f46',
          900: '#064e3b',
        }
      }
    },
  },
  plugins: [],
}