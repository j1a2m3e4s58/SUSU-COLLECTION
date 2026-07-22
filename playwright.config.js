import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4187",
    launchOptions: {
      executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4187 --strictPort",
    url: "http://127.0.0.1:4187/login",
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-360", use: { viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true } },
    { name: "mobile-400", use: { viewport: { width: 400, height: 850 }, isMobile: true, hasTouch: true } },
    { name: "mobile-430", use: { viewport: { width: 430, height: 932 }, isMobile: true, hasTouch: true } },
  ],
});
