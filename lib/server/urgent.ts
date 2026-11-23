import "server-only";
import { urgentMessage } from "../notifyMessages";
import { selectUrgentRecipients, type SharedRecord } from "../share";
import { sendPush } from "./push";
import { getStore, type SharedEventRow } from "./store";

/** 알림 C: 크론을 기다리지 않고 공유 범위의 같은 학과(·학년) 기기에 즉시 보냅니다 (등록자 제외) */
export async function sendUrgentNow(shared: SharedEventRow, now = new Date()) {
  const store = getStore();
  const devices = await store.listDevicesInDepartment(shared.departmentCode);
  const recipients = selectUrgentRecipients(shared as SharedRecord, devices);
  const { title, body } = urgentMessage(shared);
  let pushed = 0;
  await Promise.all(
    recipients.map(async (d) => {
      if (await sendPush(d.id, d.pushSubscription, { title, body, url: `/event/shared-${shared.id}`, tag: `deptUrgent:${shared.id}` })) {
        pushed++;
      }
    }),
  );
  // 푸시 구독이 없는 기기는 앱의 피드 확인(urgentSentAt)으로 앱 안 알림센터에 표시합니다
  await store.updateSharedEvent(shared.id, { urgentSentAt: now.toISOString() });
  return { recipients: recipients.length, pushed };
}
