import "server-only";
import { addDaysTo, toDateString } from "../dates";
import {
  addRegistrant,
  decideShare,
  isWithinUrgentLimit,
  widenScope,
  type Grade,
  type ShareableFields,
  type ShareScope,
  type SharedRecord,
} from "../share";
import { demoToolsEnabled } from "./auth";
import { getStore, type DeviceRow } from "./store";
import { sendUrgentNow } from "./urgent";

export class ShareError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

/** 테스트 모드의 '현재 시각'은 데모 도구가 켜져 있을 때만 받아들입니다 */
export function resolveNow(clientNow?: string | null): Date {
  if (clientNow && demoToolsEnabled()) {
    const d = new Date(clientNow);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

export async function registerShare(input: {
  device: DeviceRow;
  fields: ShareableFields;
  scope: ShareScope;
  grades: Grade[];
  now: Date;
}) {
  const { device, fields, now } = input;
  if (!device.departmentCode || !device.grade) {
    throw new ShareError("학과·학년을 먼저 골라 주세요. 설정에서 고를 수 있어요.");
  }
  const store = getStore();
  // 오늘 만든 공유(횟수 제한)와 오늘 이후 행사(합치기)를 함께 봅니다
  const existing = (await store.listSharedEvents([device.departmentCode], addDaysTo(toDateString(now), -30))) as SharedRecord[];
  const decision = decideShare({ candidate: fields, device, existing, now });

  if (decision.kind === "rejected") {
    throw new ShareError(
      decision.reason === "daily-limit" ? "공유는 하루 5건까지 할 수 있어요." : "학과를 먼저 골라 주세요.",
      429,
    );
  }
  if (decision.kind === "merged") {
    const target = existing.find((e) => e.id === decision.targetId)!;
    const registrantDeviceIds = addRegistrant(target, device.id);
    // 다른 학년이 같은 행사를 공유하면 그 학년도 볼 수 있게 범위를 넓힙니다
    const requested = { scope: input.scope, grades: input.scope === "grade" ? (input.grades.length ? input.grades : [device.grade]) : [] };
    const widened = widenScope(target, requested);
    await store.updateSharedEvent(target.id, {
      registrantDeviceIds,
      ...(widened.changed ? { scope: widened.scope, grades: widened.grades } : {}),
    });
    return { sharedEventId: target.id, merged: true, registrantCount: registrantDeviceIds.length, urgentSent: false, recipients: 0 };
  }

  const grades = input.scope === "grade" ? (input.grades.length ? input.grades : [device.grade]) : [];
  const row = await store.insertSharedEvent({
    departmentCode: device.departmentCode,
    scope: input.scope,
    grades,
    ...fields,
    origin: "student",
    isUrgent: decision.isUrgent,
    registrantDeviceIds: [device.id],
    reportDeviceIds: [],
    hidden: false,
    urgentSentAt: null,
    createdAt: now.toISOString(),
  });
  let recipients = 0;
  let sendUrgent = decision.sendUrgent;
  if (sendUrgent) {
    // 동시에 들어온 공유가 함께 한도를 넘지 않도록: 발송 시각을 먼저 기록하고 다시 세어 봅니다
    await store.updateSharedEvent(row.id, { urgentSentAt: now.toISOString() });
    const after = (await store.listSharedEvents([device.departmentCode], addDaysTo(toDateString(now), -30))) as SharedRecord[];
    sendUrgent = isWithinUrgentLimit(after, row.id, device.departmentCode, now);
    if (!sendUrgent) await store.updateSharedEvent(row.id, { urgentSentAt: null });
  }
  if (sendUrgent) recipients = (await sendUrgentNow({ ...row, urgentSentAt: now.toISOString() }, now)).recipients;
  return {
    sharedEventId: row.id,
    merged: false,
    registrantCount: 1,
    isUrgent: decision.isUrgent,
    urgentSent: sendUrgent,
    urgentLimited: decision.isUrgent && !sendUrgent,
    recipients,
  };
}
