// 저장소에서 알림 계산 입력을 읽습니다 (AppRuntime·설정 화면 공용)
import { toDateString } from "../dates";
import type { PlanInput } from "../notifyPlan";
import { mergeWithUrgent, type SharedFeedItem } from "../share";
import { STORAGE_KEYS, readJSON } from "../storage";
import { DEFAULT_NOTIFY_SETTINGS, type Category, type Event, type NotifySettings, type Timetable } from "../types";
import { combineEvents } from "../useAppData";

export function loadPlanInput(now: Date): PlanInput {
  const feed = readJSON<SharedFeedItem[]>(STORAGE_KEYS.sharedFeed, []);
  const settings = { ...DEFAULT_NOTIFY_SETTINGS, ...readJSON<NotifySettings>(STORAGE_KEYS.notifySettings, DEFAULT_NOTIFY_SETTINGS) };
  return {
    events: combineEvents(
      readJSON<Event[]>(STORAGE_KEYS.events, []),
      feed,
      readJSON<string[]>(STORAGE_KEYS.dismissedIds, []),
    ),
    addedIds: readJSON<string[]>(STORAGE_KEYS.addedEventIds, []),
    interests: readJSON<Category[]>(STORAGE_KEYS.interestCategories, []),
    settings,
    timetable: readJSON<Timetable | null>(STORAGE_KEYS.timetable, null),
    now,
    today: toDateString(now),
    urgentSent: settings.deptUrgent.enabled
      ? feed
          .filter((f) => !f.mine && f.urgentSentAt)
          .map((f) => ({ eventId: `shared-${f.id}`, at: new Date(f.urgentSentAt!) }))
      : [],
    mergeUrgent: mergeWithUrgent,
  };
}
