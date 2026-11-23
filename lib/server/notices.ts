import "server-only";
import { addDaysTo, toDateString } from "../dates";
import { runExtraction } from "../extract/run";
import { isAllowedByRobots, looksLikeEvent, parseFeed, parseListHtml, type NoticeItem } from "../notices/parse";
import { getStore } from "./store";

export const USER_AGENT = "PingCampusBot/0.1 (+student project; 학교 공지 행사 알림)";
const MIN_INTERVAL_MS = 60 * 60_000; // 수집 간격 최소 1시간
const MAX_POSTS_PER_RUN = 3; // 한 번에 글 본문은 3건까지만 엽니다
const POST_GAP_MS = 2_000;

const g = globalThis as unknown as { __pingCampusNoticesLastRun?: number };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function get(url: string): Promise<Response> {
  return fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(10_000) });
}

/** 학교 홈페이지 공지 → 행사성 글만 골라 공용 피드('*')에 등록 */
export async function collectSchoolNotices(now = new Date()) {
  const listUrl = process.env.SCHOOL_NOTICE_URL;
  if (!listUrl) return { skipped: "SCHOOL_NOTICE_URL이 없어요" };
  if (g.__pingCampusNoticesLastRun && now.getTime() - g.__pingCampusNoticesLastRun < MIN_INTERVAL_MS) {
    return { skipped: "1시간 안에 이미 수집했어요" };
  }
  g.__pingCampusNoticesLastRun = now.getTime();

  const list = new URL(listUrl);
  const robotsRes = await get(new URL("/robots.txt", list).toString()).catch(() => null);
  const robots = robotsRes?.ok ? await robotsRes.text() : "";
  if (!isAllowedByRobots(robots, list.pathname + list.search)) return { skipped: "robots.txt가 수집을 허용하지 않아요" };

  const res = await get(listUrl);
  if (!res.ok) return { skipped: `목록을 열지 못했어요 (${res.status})` };
  const body = await res.text();
  const isFeed = /xml|rss|atom/i.test(res.headers.get("content-type") ?? "") || /^\s*<\?xml|<rss|<feed/i.test(body);
  const items: NoticeItem[] = isFeed ? parseFeed(body, listUrl) : parseListHtml(body, listUrl);

  const store = getStore();
  const existing = await store.listSharedEvents(["*"], addDaysTo(toDateString(now), -60));
  const known = new Set(existing.map((e) => e.applyUrl));
  const hasAi = !!process.env.ANTHROPIC_API_KEY;
  // 이미 확인한 글(행사가 없던 글 포함)은 다시 열지 않습니다. 새 글만, AI가 없으면 키워드로 행사성 글을 먼저 고릅니다
  const candidates = items
    .filter((i) => !known.has(i.url))
    .filter((i) => hasAi || looksLikeEvent(i.title))
    .slice(0, MAX_POSTS_PER_RUN);

  let added = 0;
  for (const [idx, item] of candidates.entries()) {
    if (idx > 0) await sleep(POST_GAP_MS);
    const path = new URL(item.url).pathname;
    if (!isAllowedByRobots(robots, path)) continue;
    try {
      const extracted = await runExtraction({ mode: "link", url: item.url, source: "homepage" });
      const upcoming = extracted.events.filter((ev) => ev.date && ev.date >= toDateString(now));
      if (upcoming.length === 0) {
        // 행사가 없거나 지난 글: 숨긴 표시 행만 남겨 다음 수집에서 다시 열지 않게 합니다 (피드에는 안 보임)
        await store.insertSharedEvent({
          departmentCode: "*",
          scope: "department",
          grades: [],
          title: item.title.slice(0, 100) || "(행사 없음)",
          date: toDateString(now),
          startTime: null,
          endTime: null,
          location: null,
          category: "etc",
          applyUrl: item.url,
          origin: "homepage",
          isUrgent: false,
          registrantDeviceIds: [],
          reportDeviceIds: [],
          hidden: true,
          urgentSentAt: null,
        });
        continue;
      }
      for (const ev of upcoming) {
        if (!ev.date) continue;
        await store.insertSharedEvent({
          departmentCode: "*",
          scope: "department",
          grades: [],
          title: extracted.engine === "fallback" ? item.title.slice(0, 100) : ev.title,
          date: ev.date,
          startTime: ev.startTime,
          endTime: ev.endTime,
          location: ev.location,
          category: ev.category,
          applyUrl: item.url, // 원문 공지 링크
          origin: "homepage",
          isUrgent: false,
          registrantDeviceIds: [],
          reportDeviceIds: [],
          hidden: false,
          urgentSentAt: null,
        });
        added++;
      }
    } catch (err) {
      console.error("[notices] 글 처리 실패", item.url, (err as Error).message);
    }
  }
  return { listed: items.length, checked: candidates.length, added };
}
