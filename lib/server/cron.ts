import "server-only";
import { sendPush } from "./push";
import { getStore, type ScheduledRow } from "./store";

// 한 번에 보내는 푸시 수 (요청이 오래 걸려 시간 초과되지 않도록 병렬로 보냅니다)
const CONCURRENCY = 20;

/**
 * 도래한 알림 A·B 발송.
 * 스케줄러가 늦게 돌아도 행사 시작 전이면 보내고(시작 후면 보내지 않음),
 * 보낸 알림은 한 건씩 바로 표시해 실행이 중간에 끊겨도 다음 실행에서 다시 보내지 않습니다.
 */
export async function runNotifyCron(now = new Date()) {
  const store = getStore();
  const due = await store.listDueScheduled(now);
  let pushed = 0;
  async function sendOne(n: ScheduledRow) {
    // 먼저 보낸 것으로 표시해 동시에 돈 다른 실행과 겹쳐 보내지 않게 합니다
    await store.markSent([n.id], now);
    const device = await store.getDevice(n.deviceId);
    // 구독이 없는 기기는 앱 안 알림센터에서 기기가 직접 표시합니다
    if (await sendPush(n.deviceId, device?.pushSubscription ?? null, { title: n.title, body: n.body, url: n.url, tag: n.key })) {
      pushed++;
    }
  }
  for (let i = 0; i < due.length; i += CONCURRENCY) {
    await Promise.all(due.slice(i, i + CONCURRENCY).map(sendOne));
  }
  return { due: due.length, pushed, storage: store.kind };
}
