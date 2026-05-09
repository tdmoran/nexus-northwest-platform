import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    globals: false,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.ts"],
    exclude: ["**/*.integration.test.ts", "**/node_modules/**", "**/.next/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/lib/**/*.ts"],
      exclude: ["src/lib/db.ts", "src/lib/auth.ts", "src/lib/email.ts", "src/lib/zoho.ts"]
    }
  }
});
