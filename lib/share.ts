// 학과·학년 공유와 긴급 알림 C (PRD FR-11).
// 촉박함 판단·공유 범위·수신자 선정·합치기·신고 숨김은 이 파일에만 둡니다.
import { atSeoul, timeToMinutes, toDateString } from "./dates";
import { computeMissingFields, titleSimilarity } from "./events";
import type { Category, Event, PlannedNotification } from "./types";

export const URGENT_WINDOW_MS = 6 * 60 * 60 * 1000; // 시작까지 6시간 이내
export const MERGE_START_DIFF_MIN = 30; // 같은 행사: 시작 시각 차이 30분 이내
export const MERGE_TITLE_SIMILARITY = 0.5;
export const DAILY_URGENT_LIMIT = 3; // 학과당 하루 C 최대 3건
export const DAILY_SHARE_LIMIT = 5; // 기기당 하루 공유 5건
export const REPORT_HIDE_THRESHOLD = 2; // 서로 다른 기기 2대 이상 신고 시 숨김
export const URGENT_MERGE_WINDOW_MS = 10 * 60 * 1000; // C와 A·B가 10분 이내면 C만

export type Grade = 1 | 2 | 3 | 4;
export type ShareScope = "grade" | "department";

export interface ShareableFields {
  title: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  category: Category;
  applyUrl: string | null;
}

/** 서버에 저장되는 공유 행사 중 판단에 필요한 필드 */
export interface SharedRecord extends ShareableFields {
  id: string;
  departmentCode: string;
  scope: ShareScope;
  grades: Grade[];
  registrantDeviceIds: string[];
  reportDeviceIds: string[];
  hidden: boolean;
  isUrgent: boolean;
  urgentSentAt: string | null;
  createdAt: string;
}

export interface DeviceInfo {
  id: string;
  departmentCode: string | null;
  grade: Grade | null;
  urgentEnabled: boolean;
}

// ── 촉박함 ──

/** 촉박함 = 행사 날짜가 오늘 AND 등록 시점에 시작까지 6시간 이내 AND 아직 시작 전 */
export function isUrgent(ev: { date: string; startTime: string | null | undefined }, registeredAt: Date): boolean {
  if (!ev.startTime) return false;
  if (ev.date !== toDateString(registeredAt)) return false;
  const untilStart = atSeoul(ev.date, ev.startTime).getTime() - registeredAt.getTime();
  return untilStart > 0 && untilStart <= URGENT_WINDOW_MS;
}

/** 촉박한 행사는 공유 스위치를 자동으로 켭니다(저장 전에 끌 수 있음) */
export function defaultShareOn(ev: { date: string; startTime: string | null | undefined }, now: Date): boolean {
  return isUrgent(ev, now);
}

// ── 공유 범위 ──

/**
 * 공지의 대상 문구로 범위를 고릅니다.
 * "3학년 대상" → 학과 + 3학년, "전 학년·학과 전체" → 학과 전체, 대상 정보 없음 → 학과 + 내 학년
 */
export function suggestScope(target: string | null | undefined, myGrade: Grade | null): { scope: ShareScope; grades: Grade[] } {
  const text = target?.trim() ?? "";
  const mine = (): { scope: ShareScope; grades: Grade[] } =>
    myGrade ? { scope: "grade", grades: [myGrade] } : { scope: "department", grades: [] };
  if (!text) return mine();

  // "3학년 전체"처럼 학년이 적혀 있으면 학년을 먼저 봅니다
  const grades = new Set<Grade>();
  for (const m of text.matchAll(/([1-4](?:\s*[,·~\-]\s*[1-4])*)\s*학년/g)) {
    const range = m[1].match(/^([1-4])\s*[~\-]\s*([1-4])$/);
    if (range) {
      for (let g = Number(range[1]); g <= Number(range[2]); g++) grades.add(g as Grade);
    } else {
      for (const d of m[1].match(/[1-4]/g) ?? []) grades.add(Number(d) as Grade);
    }
  }
  if (grades.size === 4) return { scope: "department", grades: [] };
  if (grades.size > 0 && !/전\s*학년|모든\s*학년/.test(text)) return { scope: "grade", grades: [...grades].sort() };
  if (/전\s*학년|모든\s*학년|학과\s*전체|학과생\s*전체|재학생\s*(?:전체|누구나)|^전체|누구나/.test(text)) {
    return { scope: "department", grades: [] };
  }
  return mine();
}

// ── 볼 수 있는 사람 · 수신자 ──

/** 공유 범위 안에 있는 기기인지 (같은 학과, '내 학년' 범위면 대상 학년) */
export function isInScope(device: Pick<DeviceInfo, "departmentCode" | "grade">, shared: Pick<SharedRecord, "departmentCode" | "scope" | "grades">): boolean {
  if (shared.departmentCode === "*") return true; // 학교 홈페이지 공용 피드
  if (!device.departmentCode || device.departmentCode !== shared.departmentCode) return false;
  if (shared.scope === "department") return true;
  return !!device.grade && shared.grades.includes(device.grade);
}

export function canSeeInFeed(device: Pick<DeviceInfo, "departmentCode" | "grade">, shared: SharedRecord): boolean {
  return !shared.hidden && isInScope(device, shared);
}

/** 알림 C 수신자: 범위 안 + C 켜짐 + 등록자 본인 제외 + 푸시 구독 여부와 무관(앱 안 알림센터로도 받음) */
export function selectUrgentRecipients<D extends DeviceInfo>(shared: SharedRecord, devices: D[]): D[] {
  return devices.filter(
    (d) => d.urgentEnabled && !shared.registrantDeviceIds.includes(d.id) && canSeeInFeed(d, shared),
  );
}

// ── 같은 행사 합치기 ──

export function isSameSharedEvent(a: ShareableFields, b: ShareableFields): boolean {
  if (a.date !== b.date) return false;
  if (a.startTime && b.startTime) {
    if (Math.abs(timeToMinutes(a.startTime) - timeToMinutes(b.startTime)) > MERGE_START_DIFF_MIN) return false;
  } else if (a.startTime !== b.startTime) {
    return false;
  }
  return titleSimilarity(a.title, b.title) >= MERGE_TITLE_SIMILARITY;
}

export function findMergeTarget(candidate: ShareableFields, departmentCode: string, existing: SharedRecord[]): SharedRecord | undefined {
  return existing.find((e) => e.departmentCode === departmentCode && !e.hidden && isSameSharedEvent(candidate, e));
}

/**
 * 같은 행사로 합칠 때 공유 범위를 넓힙니다.
 * 3학년 범위로 올라온 행사를 1학년이 다시 공유하면 1·3학년 모두 볼 수 있게 합니다.
 */
export function widenScope(
  target: Pick<SharedRecord, "scope" | "grades">,
  added: { scope: ShareScope; grades: Grade[] },
): { scope: ShareScope; grades: Grade[]; changed: boolean } {
  if (target.scope === "department") return { scope: "department", grades: [], changed: false };
  if (added.scope === "department") return { scope: "department", grades: [], changed: true };
  const grades = [...new Set([...target.grades, ...added.grades])].sort() as Grade[];
  if (grades.length === 4) return { scope: "department", grades: [], changed: true };
  return { scope: "grade", grades, changed: grades.length !== target.grades.length };
}

// ── 공유 등록 판단 ──

export type ShareDecision =
  | { kind: "rejected"; reason: "no-department" | "daily-limit" }
  | { kind: "merged"; targetId: string; sendUrgent: false; alreadyRegistered: boolean }
  | { kind: "created"; isUrgent: boolean; sendUrgent: boolean };

export function countUrgentSentToday(records: SharedRecord[], departmentCode: string, now: Date): number {
  const today = toDateString(now);
  return records.filter(
    (r) => r.departmentCode === departmentCode && r.urgentSentAt && toDateString(new Date(r.urgentSentAt)) === today,
  ).length;
}

/**
 * 동시에 여러 건이 C를 보내려 할 때 하루 3건 안에 드는지 (urgentSentAt이 이른 순, 같으면 id 순).
 * 먼저 발송 시각을 기록한 뒤 이 함수로 다시 확인해 한도를 넘은 건은 보내지 않습니다.
 */
export function isWithinUrgentLimit(records: SharedRecord[], recordId: string, departmentCode: string, now: Date): boolean {
  const today = toDateString(now);
  const ranked = records
    .filter((r) => r.departmentCode === departmentCode && r.urgentSentAt && toDateString(new Date(r.urgentSentAt)) === today)
    .sort((a, b) => a.urgentSentAt!.localeCompare(b.urgentSentAt!) || a.id.localeCompare(b.id));
  const idx = ranked.findIndex((r) => r.id === recordId);
  return idx >= 0 && idx < DAILY_URGENT_LIMIT;
}

export function countSharesByDeviceToday(records: SharedRecord[], deviceId: string, now: Date): number {
  const today = toDateString(now);
  return records.filter(
    (r) => r.registrantDeviceIds[0] === deviceId && toDateString(new Date(r.createdAt)) === today,
  ).length;
}

/**
 * 공유 등록 시 할 일을 정합니다.
 * - 같은 행사가 이미 있으면 합치고 C를 다시 보내지 않음
 * - 새 행사가 촉박하면 C 발송 (학과당 하루 3건까지, 넘으면 피드에만)
 * - 기기당 하루 공유 5건 제한
 */
export function decideShare(input: {
  candidate: ShareableFields;
  device: DeviceInfo;
  existing: SharedRecord[]; // 같은 학과의 공유 행사 (오늘 이후 + 오늘 만든 것)
  now: Date;
}): ShareDecision {
  const { candidate, device, existing, now } = input;
  if (!device.departmentCode) return { kind: "rejected", reason: "no-department" };

  const target = findMergeTarget(candidate, device.departmentCode, existing);
  if (target) {
    return {
      kind: "merged",
      targetId: target.id,
      sendUrgent: false,
      alreadyRegistered: target.registrantDeviceIds.includes(device.id),
    };
  }
  if (countSharesByDeviceToday(existing, device.id, now) >= DAILY_SHARE_LIMIT) {
    return { kind: "rejected", reason: "daily-limit" };
  }
  const urgent = isUrgent(candidate, now);
  const sendUrgent = urgent && countUrgentSentToday(existing, device.departmentCode, now) < DAILY_URGENT_LIMIT;
  return { kind: "created", isUrgent: urgent, sendUrgent };
}

export function addRegistrant(record: SharedRecord, deviceId: string): string[] {
  return record.registrantDeviceIds.includes(deviceId)
    ? record.registrantDeviceIds
    : [...record.registrantDeviceIds, deviceId];
}

// ── 신고 ──

/** "정보가 틀려요" 신고: 서로 다른 기기 2대 이상이면 숨김 */
/** 신고할 수 있는 기기: 서버에 등록돼 있고, 그 행사를 피드에서 볼 수 있으며, 등록자 본인이 아님 */
export function canReport(device: Pick<DeviceInfo, "id" | "departmentCode" | "grade"> | null, record: SharedRecord): boolean {
  if (!device || record.registrantDeviceIds.includes(device.id)) return false;
  if (record.departmentCode === "*") return !!device.departmentCode; // 홈페이지 행사: 학과를 고른 기기만
  return isInScope(device, record);
}

export function applyReport(record: SharedRecord, deviceId: string): { reportDeviceIds: string[]; hidden: boolean; becameHidden: boolean } {
  const reportDeviceIds = record.reportDeviceIds.includes(deviceId)
    ? record.reportDeviceIds
    : [...record.reportDeviceIds, deviceId];
  const hidden = record.hidden || reportDeviceIds.length >= REPORT_HIDE_THRESHOLD;
  return { reportDeviceIds, hidden, becameHidden: hidden && !record.hidden };
}

// ── 알림 C와 A·B 중복 정리 (C > B > A) ──

/** 같은 행사의 A·B가 이미 받은 C와 10분 이내면 빼서 C 1건만 남깁니다 */
export function mergeWithUrgent(
  plans: PlannedNotification[],
  urgent: { eventId: string; at: Date }[],
): PlannedNotification[] {
  const near = (eventId: string, at: Date) =>
    urgent.some((u) => u.eventId === eventId && Math.abs(u.at.getTime() - at.getTime()) <= URGENT_MERGE_WINDOW_MS);
  const out: PlannedNotification[] = [];
  for (const p of plans) {
    const keep = p.eventIds.filter((id) => !near(id, p.notifyAt));
    if (keep.length === 0) continue;
    out.push(
      keep.length === p.eventIds.length
        ? p
        : { ...p, eventIds: keep, mergedBeforeEventIds: p.mergedBeforeEventIds?.filter((id) => keep.includes(id)) },
    );
  }
  return out;
}

// ── 클라이언트로 내려보내는 피드 항목 (등록자·신고자 기기 ID는 보내지 않음) ──

export interface SharedFeedItem extends ShareableFields {
  id: string;
  origin: "student" | "homepage";
  scope: ShareScope;
  grades: Grade[];
  registrantCount: number;
  mine: boolean;
  reportedByMe: boolean;
  isUrgent: boolean;
  urgentSentAt: string | null;
}

export function toFeedItem(r: SharedRecord & { origin: "student" | "homepage" }, viewerDeviceId: string): SharedFeedItem {
  return {
    id: r.id,
    title: r.title,
    date: r.date,
    startTime: r.startTime,
    endTime: r.endTime,
    location: r.location,
    category: r.category,
    applyUrl: r.applyUrl,
    origin: r.origin,
    scope: r.scope,
    grades: r.grades,
    registrantCount: r.registrantDeviceIds.length,
    mine: r.registrantDeviceIds.includes(viewerDeviceId),
    reportedByMe: r.reportDeviceIds.includes(viewerDeviceId),
    isUrgent: r.isUrgent,
    urgentSentAt: r.urgentSentAt,
  };
}

/** 피드 항목 → 앱 행사(공유받은 행사는 알림 A·B 대상) */
export function feedItemToEvent(item: SharedFeedItem): Event {
  const base = {
    id: `shared-${item.id}`,
    title: item.title,
    date: item.date,
    startTime: item.startTime ?? undefined,
    endTime: item.endTime ?? undefined,
    location: item.location ?? undefined,
    category: item.category,
    applyUrl: item.applyUrl ?? undefined,
    source: item.origin === "homepage" ? ("homepage" as const) : ("other" as const),
    createdAt: item.urgentSentAt ?? `${item.date}T00:00:00+09:00`,
    sharedEventId: item.id,
    sharedOrigin: item.origin,
  };
  return { ...base, missingFields: computeMissingFields(base) };
}
