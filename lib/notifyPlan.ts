// 기기에서 앞으로 보낼 알림 A·B를 계산해 메시지로 만듭니다 (판단은 schedule.ts).
import { addDaysTo } from "./dates";
import { buildMessage, type NotificationMessage } from "./notifyMessages";
import { isNotifyTarget, planNotifications } from "./schedule";
import type { Category, Event, NotifySettings, PlannedNotification, Timetable } from "./types";

export const PLAN_DAYS = 14;

export interface PlanInput {
  events: Event[]; // 내 행사 + 공유받은 행사
  addedIds: string[];
  interests: Category[];
  settings: NotifySettings;
  timetable: Timetable | null;
  now: Date;
  today: string;
  /** 이미 받은 알림 C (행사 id, 발송 시각) — 10분 이내 A·B는 C로 합칩니다 */
  urgentSent?: { eventId: string; at: Date }[];
  /** A·B 대신 C만 남길 때 쓰는 합치기 함수 (lib/share.ts) */
  mergeUrgent?: (plans: PlannedNotification[], urgent: { eventId: string; at: Date }[]) => PlannedNotification[];
}

export function computePlan(input: PlanInput): PlannedNotification[] {
  const { events, addedIds, interests, settings, timetable, now, today } = input;
  const targets = events.filter((e) =>
    isNotifyTarget(e, { interestCategories: interests, addedEventIds: addedIds, settings }),
  );
  const plans: PlannedNotification[] = [];
  for (let i = 0; i < PLAN_DAYS; i++) {
    const date = addDaysTo(today, i);
    if (!targets.some((e) => e.date === date)) continue;
    plans.push(...planNotifications(date, targets, timetable, settings, now));
  }
  const merged = input.mergeUrgent && input.urgentSent?.length ? input.mergeUrgent(plans, input.urgentSent) : plans;
  return merged.sort((a, b) => a.notifyAt.getTime() - b.notifyAt.getTime());
}

export function computeMessages(input: PlanInput): NotificationMessage[] {
  const byId = new Map(input.events.map((e) => [e.id, e]));
  return computePlan(input)
    .map((n) => buildMessage(n, byId, input.settings.beforeEvent.leadMinutes))
    .filter((m): m is NotificationMessage => !!m);
}
