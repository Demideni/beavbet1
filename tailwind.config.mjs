/** @type {import('tailwindcss').Config} */
export default {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        pulzRed: "#ff1d37",
        pulzDark: "#05040a"
      }
    }
  },
  plugins: []
};
