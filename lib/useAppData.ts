"use client";
// 화면들이 함께 쓰는 기기 저장 데이터(시간표·행사·내 일정·설정). 저장은 lib/storage.ts를 거칩니다.
import { useCallback, useEffect, useState } from "react";
import { getNow, toDateString } from "./dates";
import { MOCK_INTEREST_CATEGORIES, MOCK_TIMETABLE, getMockEvents } from "./mock";
import { STORAGE_EVENT, STORAGE_KEYS, clearAll, readJSON, removeKey, writeJSON } from "./storage";
import { feedItemToEvent, type SharedFeedItem } from "./share";
import {
  DEFAULT_NOTIFY_SETTINGS,
  type Category,
  type Event,
  type NotifySettings,
  type Timetable,
} from "./types";

export interface Profile {
  departmentCode: string | null;
  grade: 1 | 2 | 3 | 4 | null;
}

export const EMPTY_TIMETABLE: Timetable = {
  semesterStart: "2026-09-01",
  semesterEnd: "2026-12-21",
  classes: [],
  exceptions: [],
};

export interface AppState {
  now: Date;
  today: string;
  testNowActive: boolean;
  timetable: Timetable;
  events: Event[];
  addedIds: string[];
  settings: NotifySettings;
  interests: Category[];
  profile: Profile;
  onboarded: boolean;
  /** 우리 학과 피드 (서버에서 받아 둔 캐시) */
  feed: SharedFeedItem[];
  /** 내 행사 + 공유받은 행사(내가 등록하지 않은 것), '관심 없음' 제외 */
  allEvents: Event[];
  dismissedIds: string[];
  unreadCount: number;
}

/** 예시 시간표 (월 15:00, 화 16:30, 수 18:00, 목 13:00 종료) — 온보딩의 '예시 시간표 불러오기' */
export const EXAMPLE_TIMETABLE = MOCK_TIMETABLE;

/** 첫 실행 데모 데이터: 행사 6건과 기본 관심 분야. 시간표는 온보딩에서 등록합니다 */
function seedDemoData() {
  const today = toDateString(getNow());
  writeJSON(STORAGE_KEYS.timetable, EMPTY_TIMETABLE);
  writeJSON(STORAGE_KEYS.events, getMockEvents(today));
  writeJSON(STORAGE_KEYS.interestCategories, MOCK_INTEREST_CATEGORIES);
  writeJSON(STORAGE_KEYS.notifySettings, DEFAULT_NOTIFY_SETTINGS);
  writeJSON(STORAGE_KEYS.seeded, true);
}

/** 공유받은 행사를 앱 행사로 (내가 등록한 공유 행사는 내 행사로 이미 있음) */
export function sharedEventsFrom(feed: SharedFeedItem[]): Event[] {
  return feed.filter((f) => !f.mine).map(feedItemToEvent);
}

/** 화면·알림에 쓰는 전체 행사: 내 행사 + 공유받은 행사 − '관심 없음' */
export function combineEvents(events: Event[], feed: SharedFeedItem[], dismissedIds: string[]): Event[] {
  const dismissed = new Set(dismissedIds);
  return [...events, ...sharedEventsFrom(feed)].filter((e) => !dismissed.has(e.id));
}

function loadState(): AppState {
  if (!readJSON<boolean>(STORAGE_KEYS.seeded, false)) seedDemoData();
  const now = getNow();
  const settings = readJSON<NotifySettings>(STORAGE_KEYS.notifySettings, DEFAULT_NOTIFY_SETTINGS);
  const events = readJSON<Event[]>(STORAGE_KEYS.events, []);
  const feed = readJSON<SharedFeedItem[]>(STORAGE_KEYS.sharedFeed, []);
  const dismissedIds = readJSON<string[]>(STORAGE_KEYS.dismissedIds, []);
  return {
    now,
    today: toDateString(now),
    testNowActive: readJSON<string | null>(STORAGE_KEYS.testNow, null) !== null,
    timetable: readJSON<Timetable>(STORAGE_KEYS.timetable, EMPTY_TIMETABLE),
    events,
    feed,
    allEvents: combineEvents(events, feed, dismissedIds),
    dismissedIds,
    unreadCount: readJSON<{ read: boolean }[]>(STORAGE_KEYS.inbox, []).filter((i) => !i.read).length,
    addedIds: readJSON<string[]>(STORAGE_KEYS.addedEventIds, []),
    // 저장된 설정에 새 필드가 없을 때를 대비해 기본값과 합칩니다
    settings: { ...DEFAULT_NOTIFY_SETTINGS, ...settings },
    interests: readJSON<Category[]>(STORAGE_KEYS.interestCategories, MOCK_INTEREST_CATEGORIES),
    profile: readJSON<Profile>(STORAGE_KEYS.profile, { departmentCode: null, grade: null }),
    onboarded: readJSON<boolean>(STORAGE_KEYS.onboarded, false),
  };
}

export function useAppData() {
  const [state, setState] = useState<AppState | null>(null);

  useEffect(() => {
    setState(loadState());
    // 다른 컴포넌트(알림 동기화·피드)나 다른 탭에서 저장값이 바뀌면 다시 읽습니다
    const reload = () => setState(loadState());
    window.addEventListener(STORAGE_EVENT, reload);
    window.addEventListener("storage", reload);
    return () => {
      window.removeEventListener(STORAGE_EVENT, reload);
      window.removeEventListener("storage", reload);
    };
  }, []);

  const update = useCallback((patch: (prev: AppState) => Partial<AppState>) => {
    setState((prev) => (prev ? { ...prev, ...patch(prev) } : prev));
  }, []);

  const actions = {
    setTimetable(timetable: Timetable) {
      writeJSON(STORAGE_KEYS.timetable, timetable);
      update(() => ({ timetable }));
    },
    toggleAdded(id: string) {
      update((prev) => {
        const addedIds = prev.addedIds.includes(id)
          ? prev.addedIds.filter((x) => x !== id)
          : [...prev.addedIds, id];
        writeJSON(STORAGE_KEYS.addedEventIds, addedIds);
        return { addedIds };
      });
    },
    /** 공지에서 정리한 행사 저장 (addToMy면 내 일정에도 담음) */
    addEvents(newEvents: Event[], addToMy: boolean) {
      update((prev) => {
        const events = [...prev.events, ...newEvents];
        writeJSON(STORAGE_KEYS.events, events);
        const addedIds = addToMy ? [...prev.addedIds, ...newEvents.map((e) => e.id)] : prev.addedIds;
        writeJSON(STORAGE_KEYS.addedEventIds, addedIds);
        return { events, addedIds };
      });
    },
    updateEvent(id: string, patch: Partial<Event>) {
      update((prev) => {
        const events = prev.events.map((e) => (e.id === id ? { ...e, ...patch } : e));
        writeJSON(STORAGE_KEYS.events, events);
        return { events };
      });
    },
    /** '관심 없음': 목록과 알림에서 뺍니다 (내 일정에서도 뺌) */
    dismissEvent(id: string) {
      update((prev) => {
        const dismissedIds = [...new Set([...prev.dismissedIds, id])];
        const addedIds = prev.addedIds.filter((x) => x !== id);
        writeJSON(STORAGE_KEYS.dismissedIds, dismissedIds);
        writeJSON(STORAGE_KEYS.addedEventIds, addedIds);
        return { dismissedIds, addedIds };
      });
    },
    restoreDismissed() {
      writeJSON(STORAGE_KEYS.dismissedIds, []);
      update(() => ({ dismissedIds: [] }));
    },
    deleteEvent(id: string) {
      update((prev) => {
        const events = prev.events.filter((e) => e.id !== id);
        const addedIds = prev.addedIds.filter((x) => x !== id);
        writeJSON(STORAGE_KEYS.events, events);
        writeJSON(STORAGE_KEYS.addedEventIds, addedIds);
        return { events, addedIds };
      });
    },
    setSettings(settings: NotifySettings) {
      writeJSON(STORAGE_KEYS.notifySettings, settings);
      update(() => ({ settings }));
    },
    setInterests(interests: Category[]) {
      writeJSON(STORAGE_KEYS.interestCategories, interests);
      update(() => ({ interests }));
    },
    setProfile(profile: Profile) {
      writeJSON(STORAGE_KEYS.profile, profile);
      update(() => ({ profile }));
    },
    /** 테스트 모드: 현재 시각 바꾸기 (null이면 실제 시각) */
    setTestNow(at: Date | null) {
      if (at) writeJSON(STORAGE_KEYS.testNow, at.toISOString());
      else removeKey(STORAGE_KEYS.testNow);
      const now = getNow();
      update(() => ({ now, today: toDateString(now), testNowActive: at !== null }));
    },
    setOnboarded(onboarded: boolean) {
      writeJSON(STORAGE_KEYS.onboarded, onboarded);
      update(() => ({ onboarded }));
    },
    /** 모든 기기 데이터를 지우고 데모 데이터로 다시 시작 */
    resetDemo() {
      clearAll();
      setState(loadState());
    },
  };

  return { state, actions };
}
