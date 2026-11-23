import { expect, test, type Browser, type Page } from "@playwright/test";

// FR-11: 같은 학과·학년 기기 2대 (일반 창 + 시크릿 창과 같은 상황)
async function device(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext();
  await ctx.addInitScript(() => {
    if (!localStorage.getItem("ping-campus:onboarded")) {
      localStorage.setItem("ping-campus:onboarded", "true");
      localStorage.setItem("ping-campus:profile", JSON.stringify({ departmentCode: "SWE", grade: 2 }));
    }
  });
  return ctx.newPage();
}

test("촉박한 당일 행사를 공유하면 같은 학과 기기에 ⚡ 알림이 간다", async ({ browser }) => {
  const sender = await device(browser);
  const receiver = await device(browser);
  await receiver.goto("/");
  await expect(receiver.getByText(/오늘 귀가 시간|오늘은 수업이 없어요/)).toBeVisible();
  await receiver.waitForTimeout(1500); // 기기 등록

  // 지금부터 약 2시간 뒤 시작 (서울 시각)
  const kst = new Date(Date.now() + 9 * 3600e3);
  const h = kst.getUTCHours();
  test.skip(h >= 21, "밤 늦게는 오늘 안에 시작하는 행사를 만들 수 없어 건너뜁니다");
  // 오전·오후 표시가 없으면 대체 파서가 1~7시를 오후로 읽으므로 명시합니다 (새벽에 돌려도 동작)
  const sh = h + 2;
  const start = `${sh < 12 ? "오전" : "오후"} ${sh % 12 === 0 ? 12 : sh % 12}:00`;

  await sender.goto("/add");
  await sender.getByLabel("공지 내용").fill(`[공지] 오늘 ${start} 소프트웨어학과 선배 특강\n장소: 공학관 202호`);
  await sender.getByRole("button", { name: "정리하기" }).click();
  await expect(sender.getByRole("switch", { name: "우리 학과에 공유" })).toHaveAttribute("aria-checked", "true");
  await sender.getByRole("button", { name: "저장" }).click();
  await expect(sender.getByText(/바로 알렸어요/)).toBeVisible();

  await receiver.reload();
  await expect(receiver.getByText("우리 학과 긴급 행사")).toBeVisible({ timeout: 10_000 });
  await receiver.getByRole("tab", { name: /우리 학과/ }).click();
  await expect(receiver.getByText("1명이 등록했어요")).toBeVisible();
  await receiver.goto("/notifications");
  await expect(receiver.getByText("우리 학과 긴급", { exact: true }).first()).toBeVisible();
});
