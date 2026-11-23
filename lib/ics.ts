// 캘린더 내보내기: .ics 직접 생성, Google 캘린더 템플릿 링크
import { addDaysTo, atSeoul } from "./dates";
import type { Event } from "./types";

function icsDateTime(at: Date): string {
  return at.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** RFC 5545: 한 줄은 75바이트까지, 넘으면 CRLF + 공백으로 접습니다 (한글 글자를 자르지 않음) */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  const parts: string[] = [];
  let cur = "";
  let bytes = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    const limit = parts.length === 0 ? 75 : 74; // 이어지는 줄은 앞 공백 1바이트
    if (bytes + n > limit) {
      parts.push(cur);
      cur = "";
      bytes = 0;
    }
    cur += ch;
    bytes += n;
  }
  parts.push(cur);
  return parts.join("\r\n ");
}

function eventRange(e: Event): { start: Date; end: Date } | null {
  if (!e.startTime) return null;
  const start = atSeoul(e.date, e.startTime);
  const end =
    e.endTime && e.endTime > e.startTime
      ? atSeoul(e.date, e.endTime)
      : new Date(start.getTime() + 60 * 60 * 1000);
  return { start, end };
}

function description(e: Event): string {
  return [e.organizer && `주최: ${e.organizer}`, e.applyUrl && `신청: ${e.applyUrl}`, e.summary]
    .filter(Boolean)
    .join("\n");
}

export function buildIcs(events: Event[], now: Date): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Ping Campus//KO", "CALSCALE:GREGORIAN"];
  for (const e of events) {
    const range = eventRange(e);
    lines.push("BEGIN:VEVENT", `UID:${e.id}@ping-campus`, `DTSTAMP:${icsDateTime(now)}`);
    if (range) {
      lines.push(`DTSTART:${icsDateTime(range.start)}`, `DTEND:${icsDateTime(range.end)}`);
    } else {
      lines.push(
        `DTSTART;VALUE=DATE:${e.date.replace(/-/g, "")}`,
        `DTEND;VALUE=DATE:${addDaysTo(e.date, 1).replace(/-/g, "")}`,
      );
    }
    lines.push(`SUMMARY:${escapeText(e.title)}`);
    if (e.location) lines.push(`LOCATION:${escapeText(e.location)}`);
    const desc = description(e);
    if (desc) lines.push(`DESCRIPTION:${escapeText(desc)}`);
    if (e.applyUrl) lines.push(`URL:${e.applyUrl}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

export function googleCalendarUrl(e: Event): string {
  const range = eventRange(e);
  const dates = range
    ? `${icsDateTime(range.start)}/${icsDateTime(range.end)}`
    : `${e.date.replace(/-/g, "")}/${addDaysTo(e.date, 1).replace(/-/g, "")}`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates,
    ctz: "Asia/Seoul",
  });
  if (e.location) params.set("location", e.location);
  const desc = description(e);
  if (desc) params.set("details", desc);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
