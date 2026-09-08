import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  workers: 1,
  fullyParallel: false,
  timeout: 30000,
  reporter: "list",
  use: { trace: "retain-on-failure" },
});
