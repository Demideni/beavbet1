import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#0b1220",
          2: "#0a0f1a",
          card: "rgba(255,255,255,0.06)"
        },
        accent: {
          // FACEIT-like orange, used as the primary highlight color across Arena UI.
          DEFAULT: "#ff5500",
          2: "#cc3f00"
        }
      },
      boxShadow: {
        soft: "0 10px 30px rgba(0,0,0,0.35)"
      },
      borderRadius: {
        xl2: "1.25rem"
      }
    },
  },
  plugins: [],
} satisfies Config;
