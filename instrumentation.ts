// 서버 시작 시 실행. Node 런타임에서만 개발용 알림 스케줄러를 켭니다 (edge 번들에는 포함되지 않음).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
