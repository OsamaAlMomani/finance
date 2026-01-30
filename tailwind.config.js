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
        hand: ['Patrick Hand', 'cursive'],
        heading: ['Caveat', 'cursive'],
      }
    },
  },
  plugins: [],
}
