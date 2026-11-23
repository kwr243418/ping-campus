// 날짜 계산은 이 파일에만 둡니다. 시간대는 항상 Asia/Seoul.
import { addDays, differenceInCalendarDays, format, getISODay, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { STORAGE_KEYS, readJSON } from "./storage";

export const TIME_ZONE = "Asia/Seoul";

/** 현재 시각. 설정의 '현재 시각 바꾸기'(테스트 모드)가 켜져 있으면 그 시각을 씁니다. */
export function getNow(): Date {
  const override = readJSON<string | null>(STORAGE_KEYS.testNow, null);
  if (override) {
    const d = new Date(override);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

/** 테스트 모드와 관계없는 실제 현재 시각 (서버 예약 동기화용) */
export function getRealNow(): Date {
  return new Date();
}

/** 테스트 모드 '현재 시각 바꾸기'가 켜져 있는지 */
export function isTestNowActive(): boolean {
  return readJSON<string | null>(STORAGE_KEYS.testNow, null) !== null;
}

/** 시각 → 서울 기준 YYYY-MM-DD */
export function toDateString(at: Date): string {
  return formatInTimeZone(at, TIME_ZONE, "yyyy-MM-dd");
}

/** 시각 → 서울 기준 HH:mm */
export function toTimeString(at: Date): string {
  return formatInTimeZone(at, TIME_ZONE, "HH:mm");
}

/** 서울 기준 날짜·시각 → Date */
export function atSeoul(date: string, time: string): Date {
  return fromZonedTime(`${date}T${time}:00`, TIME_ZONE);
}

/** 1=월 … 7=일 */
export function weekdayOf(date: string): number {
  return getISODay(parseISO(date));
}

export function addDaysTo(date: string, days: number): string {
  return format(addDays(parseISO(date), days), "yyyy-MM-dd");
}

/** from 날짜(포함) 이후 가장 가까운 해당 요일 */
export function nextWeekday(from: string, isoWeekday: number): string {
  const diff = (isoWeekday - weekdayOf(from) + 7) % 7;
  return addDaysTo(from, diff);
}

/** "11월 23일 (월)" */
export function formatDateLabel(date: string): string {
  return format(parseISO(date), "M월 d일 (EEE)", { locale: ko });
}

export function dDay(date: string, today: string): number {
  return differenceInCalendarDays(parseISO(date), parseISO(today));
}

/** 0 → "오늘", 1 → "내일", n → "D-n", 지난 날 → "지남" */
export function dDayLabel(date: string, today: string): string {
  const d = dDay(date, today);
  if (d < 0) return "지남";
  if (d === 0) return "오늘";
  if (d === 1) return "내일";
  return `D-${d}`;
}

/** 날짜가 [today, today + days) 범위인지 */
export function isWithinDays(date: string, today: string, days: number): boolean {
  const d = dDay(date, today);
  return d >= 0 && d < days;
}

/** "11/23 (월)" */
export function formatShortDate(date: string): string {
  return format(parseISO(date), "M/d (EEE)", { locale: ko });
}

/** 그 주 월요일 */
export function weekStartOf(date: string): string {
  return addDaysTo(date, 1 - weekdayOf(date));
}

/** 월요일부터 7일 */
export function weekDates(monday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDaysTo(monday, i));
}

export const WEEKDAY_LABEL = ["", "월", "화", "수", "목", "금", "토", "일"] as const;

/** "HH:mm" → 분 */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** 분 → "HH:mm" */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** 30 → "30분 전", 60 → "1시간 전", 90 → "1시간 30분 전" */
export function leadLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}분 전`;
  return m === 0 ? `${h}시간 전` : `${h}시간 ${m}분 전`;
}

/** datetime-local 입력값(서울 기준) ↔ Date */
export function toLocalInputValue(at: Date): string {
  return formatInTimeZone(at, TIME_ZONE, "yyyy-MM-dd'T'HH:mm");
}
export function fromLocalInputValue(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  return fromZonedTime(`${value}:00`, TIME_ZONE);
}

// ── 공지 속 날짜 표현 해석 (연도 없는 날짜, 상대 표현) ──

/** 연도 없는 날짜 → base 이후(당일 포함) 가장 가까운 날짜 */
export function resolveMonthDay(month: number, day: number, base: string): string | null {
  const baseYear = Number(base.slice(0, 4));
  for (const year of [baseYear, baseYear + 1]) {
    const candidate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (!isValidDate(candidate)) return null;
    if (candidate >= base) return candidate;
  }
  return null;
}

export function isValidDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d = parseISO(date);
  return !Number.isNaN(d.getTime()) && format(d, "yyyy-MM-dd") === date;
}

export function isValidTime(time: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}

/** "오늘/내일/모레", "이번 주 목요일", "다음 주 월요일", "목요일" → 날짜 */
export function resolveRelativeDay(text: string, base: string): string | null {
  if (/모레/.test(text)) return addDaysTo(base, 2);
  if (/내일/.test(text)) return addDaysTo(base, 1);
  if (/오늘|금일/.test(text)) return base;
  const m = text.match(/(이번\s*주|다음\s*주|담주)?\s*([월화수목금토일])요일/);
  if (!m) return null;
  const target = WEEKDAY_LABEL.indexOf(m[2] as (typeof WEEKDAY_LABEL)[number]);
  if (m[1] && /다음|담주/.test(m[1])) return addDaysTo(weekStartOf(base), 7 + target - 1);
  if (m[1]) return addDaysTo(weekStartOf(base), target - 1);
  return nextWeekday(base, target);
}
