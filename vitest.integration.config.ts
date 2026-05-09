import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    globals: false,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.integration.test.ts"],
    // Tests share a Postgres instance; serialise to keep cross-test state predictable.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000
  }
});
