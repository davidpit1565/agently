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
        // Was #5f6b64 — ~3.3:1 against `surface` and ~3.5:1 against `ground`,
        // both below the 4.5:1 WCAG AA minimum for body text. This color
        // backs footer copy, form hints, and every agent's metadata line
        // (30+ call sites), so the old value was a real, widespread
        // contrast failure, not a decorative edge case. #8a978f clears
        // 6:1 against both surfaces while staying visually "faint" next to
        // `ink-soft` (#a6b3ac).
        "ink-faint": "#8a978f",
        accent: "#2fe0ad",
        "accent-strong": "#8ff5d8",
        "accent-soft": "#132821",
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      transitionTimingFunction: {
        out: "cubic-bezier(0.23, 1, 0.32, 1)",
        "in-out": "cubic-bezier(0.77, 0, 0.175, 1)",
        drawer: "cubic-bezier(0.32, 0.72, 0, 1)",
      },
      keyframes: {
        "pulse-dot": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.55", transform: "scale(0.85)" },
        },
        "glow-drift": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "50%": { transform: "translate(-2%, 3%) scale(1.08)" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shine: {
          "0%": { transform: "translateX(-120%) skewX(-15deg)" },
          "100%": { transform: "translateX(220%) skewX(-15deg)" },
        },
        "pop-in": {
          "0%": { opacity: "0", transform: "scale(0.9)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "20%, 60%": { transform: "translateX(-4px)" },
          "40%, 80%": { transform: "translateX(4px)" },
        },
        "reveal-up": {
          "0%": { opacity: "0", transform: "translateY(28px)", filter: "blur(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)", filter: "blur(0)" },
        },
        "menu-item-in": {
          "0%": { opacity: "0", transform: "translateY(18px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "word-in": {
          "0%": { opacity: "0", transform: "translateY(100%)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "pulse-dot": "pulse-dot 2s ease-in-out infinite",
        "glow-drift": "glow-drift 14s ease-in-out infinite",
        "glow-drift-slow": "glow-drift 22s ease-in-out infinite reverse",
        "fade-up": "fade-up 0.7s ease-out both",
        shine: "shine 1.1s ease-in-out",
        "pop-in": "pop-in 0.4s ease-out both",
        shake: "shake 0.4s ease-in-out",
        "reveal-up": "reveal-up 0.9s cubic-bezier(0.23, 1, 0.32, 1) both",
        "menu-item-in": "menu-item-in 0.5s cubic-bezier(0.23, 1, 0.32, 1) both",
        "word-in": "word-in 0.65s cubic-bezier(0.23, 1, 0.32, 1) both",
      },
    },
  },
  plugins: [],
};

export default config;
