/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // We can extend theme colors here if we want to map them to Tailwind classes
        // But we are using CSS variables mostly. 
      },
      fontFamily: {
        hand: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        heading: ['Exo 2', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
