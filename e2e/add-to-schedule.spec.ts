import { expect, test, type Page } from "@playwright/test";

// M4 완료 기준: 일정 등록 과업 3탭 이내 (FR-2, FR-6)
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("ping-campus:onboarded", "true"));
});

function tapCounter(page: Page) {
  let taps = 0;
  return {
    tap: async (locator: ReturnType<Page["getByRole"]>) => {
      taps++;
      await locator.click();
    },
    get count() {
      return taps;
    },
  };
}

test("홈 카드에서 1탭으로 내 일정에 담는다", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: /이번 주/ }).click();
  const t = tapCounter(page);
  await t.tap(page.getByRole("button", { name: "일정에 추가" }).first());
  await expect(page.getByRole("button", { name: "내 일정에 담았어요" }).first()).toBeVisible();
  expect(t.count).toBeLessThanOrEqual(3);

  await page.getByRole("link", { name: "내 일정" }).click();
  await expect(page.getByText("담은 행사 1건")).toBeVisible();
});

test("공지를 붙여넣어 3탭 안에 카드로 만들어 내 일정에 저장한다", async ({ page }) => {
  await page.goto("/add");
  // 붙여넣기는 탭 대신 입력으로 대신합니다 (클립보드 권한 없이 테스트)
  await page
    .getByLabel("공지 내용")
    .fill("[공지] 졸업생 초청 진로 특강\n일시: 11월 27일(금) 오후 5시~7시\n대상: 전 학년\n문의 010-1234-5678");
  const t = tapCounter(page);
  await t.tap(page.getByRole("button", { name: "정리하기" }));
  await expect(page.getByText("내용 확인")).toBeVisible();
  await expect(page.getByLabel("제목")).toHaveValue("졸업생 초청 진로 특강");
  await expect(page.getByText("장소 · 확인 필요")).toBeVisible();
  await t.tap(page.getByRole("button", { name: "저장" }));

  await page.waitForURL("**/my");
  await expect(page.getByText("졸업생 초청 진로 특강").first()).toBeVisible();
  // 붙여넣기 버튼 1탭을 더해도 3탭 이내
  expect(t.count + 1).toBeLessThanOrEqual(3);
});
