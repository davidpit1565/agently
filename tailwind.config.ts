import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#111716",
        paper: "#f7f5f1",
        accent: "#0e6b5c",
      },
    },
  },
  plugins: [],
};

export default config;
