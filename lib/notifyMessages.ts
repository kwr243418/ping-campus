// 알림 문구 (제목 접두어 [핑캠퍼스]). 판단 로직은 schedule.ts·share.ts에 있고 여기서는 글만 만듭니다.
import { atSeoul, leadLabel, toDateString, toTimeString } from "./dates";
import type { Event, PlannedNotification } from "./types";

export const TITLE_PREFIX = "[핑캠퍼스]";

/** 알림 C 문구: "⚡ 같은 학과 학생이 오늘 17:00 ○○ 특강을 등록했어요 · 인문관 301" */
export function urgentMessage(ev: { title: string; startTime?: string | null; location?: string | null }) {
  return {
    title: `${TITLE_PREFIX} ⚡ 우리 학과 당일 행사`,
    body: `같은 학과 학생이 오늘 ${ev.startTime ?? ""} ${ev.title}을(를) 등록했어요 · ${ev.location ?? "장소 확인 필요"}`,
  };
}

export interface NotificationMessage {
  key: string;
  kind: PlannedNotification["kind"];
  notifyAt: string;
  /** 이 시각이 지나면 보내지 않음 = 묶인 행사 중 가장 늦은 시작 시각 */
  expiresAt: string;
  title: string;
  body: string;
  url: string;
  eventIds: string[];
  sharedEventIds: string[];
}

/**
 * 같은 알림을 다시 계산해도 같은 키가 나오도록: 종류 + 행사 + 행사 날짜·시각(A) 또는 귀가 시각(B).
 * 행사 날짜·시간을 바꾸면 키가 달라져 새 알림으로 다시 예약됩니다.
 */
export function notificationKey(n: PlannedNotification, events: Pick<Event, "id" | "date" | "startTime">[] = []): string {
  const ids = [...n.eventIds].sort().join(",");
  if (n.kind === "atGoHome") return `${n.kind}:${ids}:${toDateString(n.notifyAt)} ${toTimeString(n.notifyAt)}`;
  const anchor = events.map((e) => `${e.date} ${e.startTime ?? ""}`).sort().join(",");
  return `${n.kind}:${ids}:${anchor}`;
}

export function buildMessage(
  n: PlannedNotification,
  eventsById: Map<string, Event>,
  leadMinutes: number,
): NotificationMessage | null {
  const evs = n.eventIds.map((id) => eventsById.get(id)).filter((e): e is Event => !!e && !!e.startTime);
  const first = evs[0];
  if (!first) return null;
  const place = first.location ?? "장소 확인 필요";
  const starts = evs.map((e) => atSeoul(e.date, e.startTime!).getTime());
  const expiresAt = new Date(Math.max(...starts));
  let title: string;
  let body: string;
  if (n.kind === "atGoHome") {
    const merged = (n.mergedBeforeEventIds?.length ?? 0) > 0;
    title = `${TITLE_PREFIX} 수업 끝! 집에 가기 전에 확인하세요`;
    body =
      `오늘 열리는 행사 ${evs.length}개 · ${first.startTime} ${first.title}` +
      (evs.length > 1 ? ` 외 ${evs.length - 1}건` : ` · ${place}`) +
      (merged ? ` (${leadLabel(leadMinutes).replace(" 전", " 뒤")} 시작)` : "");
  } else if (n.kind === "deptUrgent") {
    ({ title, body } = urgentMessage(first));
  } else {
    // 늦게 추가해 바로 보내는 A는 실제로 남은 시간을 씁니다
    const left = Math.max(1, Math.round((starts[0] - n.notifyAt.getTime()) / 60_000));
    title = `${TITLE_PREFIX} ${leadLabel(Math.min(left, leadMinutes)).replace(" 전", " 뒤")} 시작`;
    body = `${first.startTime} · ${place} · ${first.title}`;
  }
  return {
    key: notificationKey(n, evs),
    kind: n.kind,
    notifyAt: n.notifyAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    title,
    body,
    url: evs.length === 1 ? `/event/${encodeURIComponent(first.id)}` : "/",
    eventIds: n.eventIds,
    sharedEventIds: evs.map((e) => e.sharedEventId).filter((x): x is string => !!x),
  };
}
