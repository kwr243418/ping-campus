// 시간표·귀가 시간·알림 A·B 판단은 이 파일에만 둡니다. (PRD FR-1, FR-7)
import { atSeoul, timeToMinutes, weekdayOf } from "./dates";
import type { Category, Event, NotifySettings, PlannedNotification, Timetable } from "./types";

const MERGE_WINDOW_MS = 10 * 60 * 1000;

/** 그날 실제로 열리는 수업 블록 (학기 기간·휴강·보강·공휴일 반영) */
export interface DayClass {
  id: string;
  start: string;
  end: string;
  name?: string;
  room?: string;
  makeup?: boolean;
}

export function getClassesForDate(date: string, timetable: Timetable | null): DayClass[] {
  if (!timetable) return [];
  const exceptions = timetable.exceptions.filter((e) => e.date === date);
  if (exceptions.some((e) => e.type === "holiday")) return [];

  const result: DayClass[] = [];
  const inSemester = date >= timetable.semesterStart && date <= timetable.semesterEnd;
  if (inSemester) {
    const weekday = weekdayOf(date);
    const cancelled = new Set(
      exceptions.filter((e) => e.type === "cancel" && e.classId).map((e) => e.classId),
    );
    for (const c of timetable.classes) {
      if (c.weekday === weekday && !cancelled.has(c.id)) {
        result.push({ id: c.id, start: c.start, end: c.end, name: c.name, room: c.room });
      }
    }
  }
  exceptions.forEach((e, i) => {
    if (e.type === "makeup" && e.start && e.end) {
      result.push({ id: `makeup-${date}-${i}`, start: e.start, end: e.end, name: "보강", makeup: true });
    }
  });
  return result.sort((a, b) => a.start.localeCompare(b.start));
}

/**
 * 귀가 시간(date) = 그날 적용되는 수업(시간표 + 예외) 중 가장 늦은 종료 시각.
 * 수업이 없으면 null. override 예외가 있으면 그 값을 씁니다.
 */
export function getGoHomeTime(date: string, timetable: Timetable | null): string | null {
  if (!timetable) return null;
  const exceptions = timetable.exceptions.filter((e) => e.date === date);
  if (exceptions.some((e) => e.type === "holiday")) return null;
  const override = exceptions.find((e) => e.type === "override" && e.goHomeTime);
  if (override?.goHomeTime) return override.goHomeTime;

  const classes = getClassesForDate(date, timetable);
  if (classes.length === 0) return null;
  return classes.reduce((latest, c) => (c.end > latest ? c.end : latest), classes[0].end);
}

/** 요일별 귀가 시간 (예외 없이 시간표만 기준, 시간표 편집 화면용) */
export function getWeekdayGoHomeTime(weekday: number, timetable: Timetable | null): string | null {
  if (!timetable) return null;
  const ends = timetable.classes.filter((c) => c.weekday === weekday).map((c) => c.end);
  return ends.length ? ends.reduce((a, b) => (b > a ? b : a)) : null;
}

/** 행사 시간대가 그날 수업 블록과 겹치는지 (종료 시각이 없으면 1시간으로 봄) */
export function overlapsClass(event: Event, timetable: Timetable | null): boolean {
  if (!event.startTime) return false;
  const start = timeToMinutes(event.startTime);
  const end = event.endTime ? timeToMinutes(event.endTime) : start + 60;
  return getClassesForDate(event.date, timetable).some(
    (c) => start < timeToMinutes(c.end) && timeToMinutes(c.start) < end,
  );
}

/** 같은 요일 수업끼리 시간이 겹치는지 (시간표 입력 검증) */
export function findClassConflict(
  candidate: { id?: string; weekday: number; start: string; end: string },
  timetable: Timetable,
) {
  return timetable.classes.find(
    (c) =>
      c.id !== candidate.id &&
      c.weekday === candidate.weekday &&
      candidate.start < c.end &&
      c.start < candidate.end,
  );
}

/** 카드의 시간표 비교 줄에 쓰는 판단 결과 */
export type TimetableFit =
  | { kind: "noTime" } // 시작 시각 없음 → '시간 확인 필요'
  | { kind: "noClass" } // 이날은 수업이 없어요
  | { kind: "afterClass"; goHomeTime: string } // 수업 후 참석 가능
  | { kind: "sameTime"; goHomeTime: string } // 수업 끝나자마자 시작
  | { kind: "overlap"; goHomeTime: string }; // 수업 시간과 겹쳐요

export function compareWithTimetable(
  event: Pick<Event, "date" | "startTime">,
  timetable: Timetable | null,
): TimetableFit {
  if (!event.startTime) return { kind: "noTime" };
  const goHomeTime = getGoHomeTime(event.date, timetable);
  if (!goHomeTime) return { kind: "noClass" };
  if (event.startTime > goHomeTime) return { kind: "afterClass", goHomeTime };
  if (event.startTime === goHomeTime) return { kind: "sameTime", goHomeTime };
  return { kind: "overlap", goHomeTime };
}

export interface TargetContext {
  interestCategories: Category[];
  addedEventIds: string[];
  settings: NotifySettings;
}

/**
 * 대상 행사 = (관심 카테고리 OR '내 일정'에 담음 OR 같은 학과·학년에서 공유받음)
 *            AND date, startTime 존재
 * 관심 카테고리로만 대상이 된 행사는 '카테고리별 끄기'가 적용됩니다.
 */
export function isNotifyTarget(event: Event, ctx: TargetContext): boolean {
  if (!event.date || !event.startTime) return false;
  if (ctx.addedEventIds.includes(event.id)) return true;
  // 같은 학과·학년에서 공유받은 행사는 대상 (학교 홈페이지 공용 피드는 관심 분야일 때만)
  if (event.sharedEventId && event.sharedOrigin !== "homepage") return true;
  return (
    ctx.interestCategories.includes(event.category) &&
    !ctx.settings.mutedCategories.includes(event.category)
  );
}

/**
 * 하루치 알림 A·B를 계산합니다. events는 '대상 행사' 목록입니다.
 * - A: 행사 시작 − leadMinutes. 이미 지났으면 시작 전이면 즉시, 시작 후면 보내지 않음
 * - B: 귀가 시간 이후 시작하는 행사가 있을 때 귀가 시간에 1건으로 묶음 (이미 지났으면 보내지 않음)
 * - 같은 행사의 A·B가 10분 이내면 B 하나로 합침
 */
export function planNotifications(
  date: string,
  events: Event[],
  timetable: Timetable | null,
  settings: NotifySettings,
  now: Date,
): PlannedNotification[] {
  const dayEvents = events
    .filter((e): e is Event & { startTime: string } => e.date === date && !!e.startTime)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const before: PlannedNotification[] = [];
  if (settings.beforeEvent.enabled) {
    for (const e of dayEvents) {
      const start = atSeoul(date, e.startTime);
      let notifyAt = new Date(start.getTime() - settings.beforeEvent.leadMinutes * 60_000);
      if (notifyAt < now) {
        if (start > now) notifyAt = now;
        else continue;
      }
      before.push({ kind: "beforeEvent", notifyAt, eventIds: [e.id] });
    }
  }

  let atGoHome: PlannedNotification | null = null;
  const goHomeTime = getGoHomeTime(date, timetable);
  if (settings.atGoHome.enabled && goHomeTime) {
    const notifyAt = atSeoul(date, goHomeTime);
    const afterClass = dayEvents.filter((e) => e.startTime > goHomeTime);
    if (afterClass.length > 0 && notifyAt >= now) {
      atGoHome = {
        kind: "atGoHome",
        notifyAt,
        eventIds: afterClass.map((e) => e.id),
        mergedBeforeEventIds: [],
      };
    }
  }

  const result: PlannedNotification[] = [];
  for (const a of before) {
    const id = a.eventIds[0];
    if (
      atGoHome &&
      atGoHome.eventIds.includes(id) &&
      Math.abs(a.notifyAt.getTime() - atGoHome.notifyAt.getTime()) <= MERGE_WINDOW_MS
    ) {
      atGoHome.mergedBeforeEventIds!.push(id);
      continue;
    }
    result.push(a);
  }
  if (atGoHome) result.push(atGoHome);

  return result.sort((x, y) => x.notifyAt.getTime() - y.notifyAt.getTime());
}

/**
 * 카드에 보여 줄 '이 행사의' 알림 예정 목록.
 * 대상 행사가 아니어도 '일정에 추가하면 받을 알림'을 미리 보여 주기 위해 event를 포함해 계산합니다.
 */
export function planForEvent(
  event: Event,
  targetEvents: Event[],
  timetable: Timetable | null,
  settings: NotifySettings,
  now: Date,
): PlannedNotification[] {
  if (!event.startTime) return [];
  const sameDay = targetEvents.filter((e) => e.date === event.date && e.id !== event.id);
  return planNotifications(event.date, [...sameDay, event], timetable, settings, now).filter(
    (n) => n.eventIds.includes(event.id),
  );
}

/** "오늘 수업 끝나고 갈 수 있는 행사" — 아직 시작 전이고, 수업 후(또는 수업 없는 날) 시작하는 행사 */
export function isAttendableAfterClass(
  event: Event,
  timetable: Timetable | null,
  now: Date,
): boolean {
  if (!event.startTime || atSeoul(event.date, event.startTime) <= now) return false;
  const kind = compareWithTimetable(event, timetable).kind;
  return kind === "afterClass" || kind === "sameTime" || kind === "noClass";
}

/** 앞으로 받을 알림 (내 일정 화면): 대상 행사의 날짜별 A·B 계산 결과를 시각순으로 */
export function upcomingNotifications(
  targetEvents: Event[],
  timetable: Timetable | null,
  settings: NotifySettings,
  now: Date,
  today: string,
): PlannedNotification[] {
  const dates = [...new Set(targetEvents.map((e) => e.date))].filter((d) => d >= today).sort();
  return dates
    .flatMap((d) => planNotifications(d, targetEvents, timetable, settings, now))
    .filter((n) => n.notifyAt >= now)
    .sort((a, b) => a.notifyAt.getTime() - b.notifyAt.getTime());
}
