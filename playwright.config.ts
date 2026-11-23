import { defineConfig } from "@playwright/test";

// 핵심 흐름 E2E. 처음 한 번 `npx playwright install chromium`이 필요합니다.
// 설치된 Chrome을 쓰려면 PW_CHANNEL=chrome npm run test:e2e
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    channel: process.env.PW_CHANNEL || undefined,
    viewport: { width: 390, height: 844 },
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
