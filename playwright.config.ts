import { defineConfig, devices } from "@playwright/test";

const port = process.env.PLAYWRIGHT_PORT ?? "3100";
const baseURL = `http://localhost:${port}`;
const teacherPassword =
  process.env.TEACHER_BOOTSTRAP_PASSWORD ?? "playwright-teacher-password";

export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    command: `npm run build && next start -p ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    env: {
      ...process.env,
      TEACHER_BOOTSTRAP_USERNAME: "owner",
      TEACHER_BOOTSTRAP_PASSWORD: teacherPassword,
    },
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // If Playwright 1.60 cannot find chromium_headless_shell-1223,
        // set PLAYWRIGHT_CHROME_CHANNEL=chrome to use an installed Chrome.
        ...(process.env.PLAYWRIGHT_CHROME_CHANNEL
          ? { channel: process.env.PLAYWRIGHT_CHROME_CHANNEL }
          : {}),
      },
    },
  ],
});
