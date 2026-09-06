import { defineConfig } from "vitest/config";
import path from "path";

// Unit tests only, for now — pure functions in lib/ with no Supabase/Stripe/
// Next.js runtime dependency. Nothing here spins up a server or touches a
// real database; that's a different, bigger investment (integration tests)
// left for later.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
  },
});
