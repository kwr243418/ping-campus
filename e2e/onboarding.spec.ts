import { expect, test } from "@playwright/test";

// FR-8 온보딩: 첫 실행 → 4단계 → 홈
test("첫 실행이면 온보딩 4단계를 거쳐 홈으로 간다", async ({ page }) => {
  await page.goto("/");
  await page.waitForURL("**/onboarding");

  // ① 학과·학년
  const next = page.getByRole("button", { name: "다음" });
  await expect(next).toBeDisabled();
  await page.getByRole("radio", { name: "3학년" }).click();
  await page.getByLabel("학과 검색").fill("컴퓨터");
  await page.getByRole("button", { name: /컴퓨터공학과/ }).click();
  await next.click();

  // ② 시간표: 예시 불러오기 → 귀가 시간이 요일 아래 표시
  await expect(page.getByRole("button", { name: "시간표 없이 계속" })).toBeVisible();
  await page.getByRole("button", { name: /예시 시간표 불러오기/ }).click();
  await expect(page.getByText("~15:00")).toBeVisible();
  await page.getByRole("button", { name: "다음" }).click();

  // ③ 관심 분야: 모두 끄면 다음으로 못 감
  await expect(page.getByRole("heading", { name: "어떤 행사가 궁금하세요?" })).toBeVisible();
  for (const name of ["특강", "채용", "공모전", "학과행사"]) {
    await page.getByRole("button", { name, exact: true }).click();
  }
  await expect(page.getByRole("button", { name: "하나 이상 골라 주세요" })).toBeDisabled();
  await page.getByRole("button", { name: "특강", exact: true }).click();
  await page.getByRole("button", { name: "다음" }).click();

  // ④ 알림 → 시작
  await expect(page.getByRole("heading", { name: "알림을 켜 주세요" })).toBeVisible();
  await page.getByRole("button", { name: "핑캠퍼스 시작하기" }).click();
  await page.waitForURL((url) => url.pathname === "/");
  await expect(page.getByText(/오늘 귀가 시간|오늘은 수업이 없어요/)).toBeVisible();

  // 다시 열어도 온보딩으로 가지 않고, 설정에 고른 학과가 남아 있음
  await page.getByRole("link", { name: "설정" }).click();
  await expect(page.getByText("컴퓨터공학과 · 공과대학")).toBeVisible();
});

test("학과·시간표를 건너뛰면 안내하고, 홈에 시간표 등록 배너를 띄운다", async ({ page }) => {
  await page.goto("/onboarding");
  await page.getByRole("button", { name: "나중에 고를게요" }).click();
  await expect(page.getByText(/우리 학과 공유·긴급 알림/)).toBeVisible();
  await page.getByRole("button", { name: "학과 없이 계속" }).click();

  await expect(page.getByText(/행사 1시간 전 알림.*만 받아요/)).toBeVisible();
  await page.getByRole("button", { name: "시간표 없이 계속" }).click();
  await page.getByRole("button", { name: "다음" }).click();
  await page.getByRole("button", { name: "핑캠퍼스 시작하기" }).click();

  await page.waitForURL((url) => url.pathname === "/");
  await expect(page.getByText("시간표를 등록하면 수업이 끝날 때도 알려 드려요")).toBeVisible();
});
