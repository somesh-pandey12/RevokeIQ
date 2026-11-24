import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    fileParallelism: false,
    env: {
      NODE_ENV: "test",
      MONGODB_URI: "mongodb://127.0.0.1:27017/resolveiq_test?directConnection=true",
      JWT_SECRET: "test_secret_test_secret_test_secret_1234",
    },
  },
});