import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setupEnv.js"],
    include: ["tests/**/*.test.js"],
    testTimeout: 60000,
    hookTimeout: 60000,
    fileParallelism: false,
  },
});
