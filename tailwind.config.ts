import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ground: "#0a0d0b",
        surface: "#121613",
        "surface-raised": "#181d19",
        line: "#242b26",
        ink: "#edf3ee",
        "ink-soft": "#a6b3ac",
        "ink-faint": "#5f6b64",
        accent: "#2fe0ad",
        "accent-strong": "#8ff5d8",
        "accent-soft": "#132821",
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      keyframes: {
        "pulse-dot": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.55", transform: "scale(0.85)" },
        },
      },
      animation: {
        "pulse-dot": "pulse-dot 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
