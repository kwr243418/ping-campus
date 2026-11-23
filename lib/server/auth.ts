import "server-only";

/** 크론 라우트: Authorization: Bearer ${CRON_SECRET} 검사 */
export function isCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * 데모 도구('가상 학과 친구가 등록하기', 테스트 시각으로 공유 판단) 허용 여부.
 * 개발 서버에서는 기본으로 켜고, 배포(production)에서는 ENABLE_DEMO_TOOLS=true일 때만 켭니다.
 */
export function demoToolsEnabled(): boolean {
  const flag = process.env.ENABLE_DEMO_TOOLS;
  if (flag === "true") return true;
  if (flag === "false") return false;
  return process.env.NODE_ENV !== "production";
}
