// 로컬 개발 서버에서는 외부 스케줄러가 없으므로, 1분마다 같은 발송 로직을 서버 안에서 돌립니다.
// 배포 환경에서는 GitHub Actions 등 10분 스케줄러가 /api/cron/notify를 호출합니다.
import { runNotifyCron } from "./lib/server/cron";

const g = globalThis as unknown as { __pingCampusDevCron?: boolean };

if (process.env.NODE_ENV === "development" && !g.__pingCampusDevCron) {
  g.__pingCampusDevCron = true;
  setInterval(() => {
    runNotifyCron()
      .then((r) => r.due > 0 && console.log(`[dev-cron] 알림 ${r.due}건 처리, 푸시 ${r.pushed}건`))
      .catch((e) => console.error("[dev-cron]", e));
  }, 60_000);
  console.log("[dev-cron] 1분 간격 알림 발송 시작");
}
