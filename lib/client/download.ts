import { buildIcs } from "../ics";
import type { Event } from "../types";

/** .ics 파일 내려받기 */
export function downloadIcs(events: Event[], now: Date, filename: string) {
  const blob = new Blob([buildIcs(events, now)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
