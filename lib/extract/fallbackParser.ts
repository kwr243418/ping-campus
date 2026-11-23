// API 키가 없거나 AI 응답 검증에 실패했을 때 쓰는 정규식 기반 대체 파서 (데모용).
// 행사 1건만 뽑고, 찾지 못한 값은 비워 둡니다.
import { minutesToTime, resolveMonthDay, resolveRelativeDay, isValidDate } from "../dates";
import type { Category } from "../types";
import type { ExtractedEvent } from "./schema";

const CATEGORY_KEYWORDS: [Category, RegExp][] = [
  ["scholarship", /장학/],
  ["contest", /공모전|대회|해커톤|경진/],
  ["career", /채용|취업|인턴|직무|기업\s*설명회|커리어\s*페어|잡\s*페어/],
  ["club", /동아리|공연|버스킹|정기\s*연주/],
  ["lecture", /특강|강연|세미나|강의|콜로키움|워크숍|워크샵/],
  ["dept", /학과|학생회|총회|MT|개강총회|종강총회|간담회|멘토링/],
];

/** 카톡 대화 타임스탬프는 행사 시간으로 오인하지 않도록 지웁니다 */
function stripChatTimestamps(text: string): string {
  return text
    .replace(/\[(?:오전|오후)\s*\d{1,2}:\d{2}\]/g, " ")
    .replace(/\d{4}년\s*\d{1,2}월\s*\d{1,2}일\s*(?:오전|오후)\s*\d{1,2}:\d{2},[^:\n]*:\s/g, "");
}

function findLabeled(lines: string[], label: RegExp): string | null {
  for (const line of lines) {
    const m = line.match(label);
    if (m?.[1]?.trim()) return m[1].trim();
  }
  return null;
}

function parseDate(text: string, base: string): string | null {
  const full = text.match(/(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})\s*일?/);
  if (full) {
    const d = `${full[1]}-${full[2].padStart(2, "0")}-${full[3].padStart(2, "0")}`;
    if (isValidDate(d)) return d;
  }
  const md = text.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  if (md) return resolveMonthDay(Number(md[1]), Number(md[2]), base);
  const slash = text.match(/(?<![\d.:])(\d{1,2})[./](\d{1,2})(?![\d:])(?:\s*\(([월화수목금토일])\))?/);
  if (slash) {
    const month = Number(slash[1]);
    const day = Number(slash[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) return resolveMonthDay(month, day, base);
  }
  return resolveRelativeDay(text, base);
}

const TIME_RE =
  /(오전|오후|저녁|밤|낮|아침)?\s*(?:(\d{1,2}):(\d{2})|(\d{1,2})\s*시(?!간)\s*(?:(\d{1,2})\s*분|(반))?)/g;

interface TimeHit {
  minutes: number;
  explicitPeriod: boolean;
  index: number;
  end: number;
}

function toMinutes(period: string | undefined, h: number, m: number): { minutes: number; explicit: boolean } | null {
  if (h > 24 || m > 59) return null;
  let hour = h;
  const pm = period && /오후|저녁|밤/.test(period);
  const am = period && /오전|아침/.test(period);
  if (pm && hour < 12) hour += 12;
  if (am && hour === 12) hour = 0;
  // 오전·오후 표시 없는 1~7시는 오후 행사로 봅니다 (교내 행사 관례)
  if (!period && hour >= 1 && hour <= 7) hour += 12;
  if (hour >= 24) return null;
  return { minutes: hour * 60 + m, explicit: !!(pm || am) };
}

function parseTimes(text: string): { start: string | null; end: string | null } {
  const hits: TimeHit[] = [];
  for (const m of text.matchAll(TIME_RE)) {
    const h = Number(m[2] ?? m[4]);
    const min = m[3] ? Number(m[3]) : m[5] ? Number(m[5]) : m[6] ? 30 : 0;
    if (Number.isNaN(h)) continue;
    const t = toMinutes(m[1], h, min);
    if (!t) continue;
    hits.push({ minutes: t.minutes, explicitPeriod: t.explicit, index: m.index!, end: m.index! + m[0].length });
  }
  if (hits.length === 0) return { start: null, end: null };
  const first = hits[0];
  const second = hits[1];
  const between = second ? text.slice(first.end, second.index) : "";
  if (second && /^\s*[~\-–—]\s*$|^\s*부터\s*$/.test(between)) {
    let end = second.minutes;
    if (end <= first.minutes && end + 12 * 60 < 24 * 60) end += 12 * 60;
    return { start: minutesToTime(first.minutes), end: end > first.minutes ? minutesToTime(end) : null };
  }
  return { start: minutesToTime(first.minutes), end: null };
}

const LOCATION_RE =
  /([가-힣A-Za-z0-9]+(?:관|센터|홀|강당|라운지|도서관|캠퍼스)(?:\s*\d{1,2}층)?(?:\s*[A-Za-z]?\d{1,4}호?)?(?:\s*[가-힣]*(?:실|라운지|소극장|극장|홀|강당))?)/;

export function parseNoticeFallback(rawText: string, baseDate: string): ExtractedEvent {
  const text = stripChatTimestamps(rawText);
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // 날짜·시간은 '일시' 같은 줄을 먼저 보고, 없으면 신청·마감 줄을 뺀 나머지에서 찾습니다
  // '점심시간' 같은 낱말에 걸리지 않도록 라벨(콜론) 형태만 봅니다
  const whenLines = lines.filter((l) => /(일시|일자|날짜|시간|일정|언제)\s*[:：]|📅|🗓|⏰/.test(l));
  const nonDeadline = lines.filter((l) => !/마감|신청\s*기간|접수|까지\s*신청/.test(l));
  const whenText = (whenLines.length ? whenLines : nonDeadline.length ? nonDeadline : lines).join("\n");

  const date = parseDate(whenText, baseDate) ?? parseDate(nonDeadline.join("\n"), baseDate);
  const { start, end } = parseTimes(whenText);

  let location = findLabeled(lines, /(?:(?:장\s*소|위\s*치)\s*[:：]|📍)\s*(.+)/);
  // "장소: 추후 공지" 같은 값은 장소가 없는 것으로 봅니다
  if (location && /미정|추후|확정\s*되는|공지\s*예정|TBD/i.test(location)) location = null;
  if (!location) location = nonDeadline.join(" ").match(LOCATION_RE)?.[1] ?? null;

  const titleLabeled = findLabeled(lines, /(?:제\s*목|행사명|주\s*제)\s*[:：]\s*(.+)/);
  const firstLine =
    lines
      // 앞쪽의 [마스킹]·[공지]·【안내】 같은 꼬리표를 모두 걷어 냅니다
      .map((l) => l.replace(/^(?:\s*[\[【<(][^\]】>)\n]{0,12}[\]】>)])+\s*/, ""))
      .map((l) => l.replace(/^(?:공지|안내|홍보|알림)\s*[:：]?\s*/, ""))
      .map((l) => l.replace(/^[^\p{L}\p{N}]+/u, "").trim())
      // 제목 앞의 날짜·시간 표현("오늘 17:00", "11/20(금)")은 따로 뽑았으므로 제목에서 뺍니다
      .map((l) =>
        l
          .replace(/^(?:(?:오늘|내일|모레|금일)\s*)?(?:\d{1,2}\s*[./월]\s*\d{1,2}\s*일?\s*(?:\([월화수목금토일]\))?\s*)?(?:(?:오전|오후)\s*)?(?:\d{1,2}:\d{2}|\d{1,2}\s*시(?!간))?\s*(?:에|부터)?\s+/, "")
          .trim(),
      )
      .find((l) => l.length >= 3 && !/^(일시|장소|대상|신청|문의)/.test(l)) ?? "";
  const title = (titleLabeled ?? firstLine).slice(0, 60) || "제목 없는 행사";

  const category = CATEGORY_KEYWORDS.find(([, re]) => re.test(text))?.[0] ?? "etc";
  const applyUrl = text.match(/https?:\/\/[^\s)>\]]+/)?.[0] ?? null;
  const organizer = findLabeled(lines, /(?:주\s*최|주\s*관)\s*[:：]?\s*(.+)/);
  const target = findLabeled(lines, /(?:대\s*상)\s*[:：]?\s*(.+)/);

  return {
    title,
    date,
    startTime: start,
    endTime: end,
    location,
    organizer,
    category,
    target,
    applyUrl,
    applyDeadline: null,
    summary: null,
    confidence: {
      title: titleLabeled ? "medium" : "low",
      date: date ? "medium" : "low",
      startTime: start ? "medium" : "low",
      location: location ? "medium" : "low",
    },
  };
}
