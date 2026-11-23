"use client";

import { useEffect } from "react";
import { getDeviceId, hasPushSubscription, postJSON, registerDevice, showLocalNotification } from "@/lib/client/device";
import { addToInbox, deliveredKeys } from "@/lib/client/inbox";
import { REFRESH_FEED_EVENT } from "@/lib/client/share";
import { loadPlanInput } from "@/lib/client/planInput";
import { getNow, getRealNow, isTestNowActive } from "@/lib/dates";
import { urgentMessage } from "@/lib/notifyMessages";
import { computeMessages } from "@/lib/notifyPlan";
import type { SharedFeedItem } from "@/lib/share";
import { STORAGE_EVENT, STORAGE_KEYS, readJSON, writeJSON, type StorageKey } from "@/lib/storage";
import { DEFAULT_NOTIFY_SETTINGS, type NotifySettings } from "@/lib/types";

const DUE_WINDOW_MS = 10 * 60_000;
const TICK_MS = 15_000;
const FEED_POLL_MS = 45_000;

/** 알림 예약에 영향을 주는 저장값 */
const SCHEDULE_KEYS: StorageKey[] = [
  STORAGE_KEYS.timetable,
  STORAGE_KEYS.events,
  STORAGE_KEYS.addedEventIds,
  STORAGE_KEYS.notifySettings,
  STORAGE_KEYS.interestCategories,
  STORAGE_KEYS.sharedFeed,
  STORAGE_KEYS.dismissedIds,
];

/**
 * 화면에 보이지 않는 앱 런타임
 * - 서비스 워커 등록, 익명 기기 등록
 * - 알림 A·B 예약을 서버와 동기화 (시간표·행사·설정이 바뀌면 다시 계산)
 * - 도래한 알림을 앱 안 알림센터에 넣고, 권한이 있으면 기기 알림으로 띄움 (푸시가 없어도 시연 가능)
 * - 우리 학과 피드를 주기적으로 받아 알림 C를 알림센터에 표시
 */
export function AppRuntime() {
  useEffect(() => {
    let disposed = false;
    let pushActive = false;
    let syncTimer: ReturnType<typeof setTimeout> | undefined;

    if ("serviceWorker" in navigator) {
      const cache = process.env.NODE_ENV === "production" ? "1" : "0";
      navigator.serviceWorker.register(`/sw.js?cache=${cache}`).catch((e) => console.warn("[sw]", e));
    }

    const settings = () => ({
      ...DEFAULT_NOTIFY_SETTINGS,
      ...readJSON<NotifySettings>(STORAGE_KEYS.notifySettings, DEFAULT_NOTIFY_SETTINGS),
    });

    async function syncSchedule() {
      try {
        await registerDevice();
        pushActive = await hasPushSubscription();
        // 서버 예약은 실제 시각 기준 (테스트 모드 시각은 기기 안에서만 씀)
        const messages = computeMessages(loadPlanInput(getRealNow()));
        await postJSON("/api/notify/schedule", {
          deviceId: getDeviceId(),
          notifications: messages.map(({ key, kind, notifyAt, expiresAt, title, body, url, sharedEventIds }) => ({
            key,
            kind,
            notifyAt,
            expiresAt,
            title,
            body,
            url,
            sharedEventIds,
          })),
        });
      } catch (e) {
        console.warn("[sync] 알림 예약 동기화 실패", (e as Error).message);
      }
    }
    const scheduleSync = () => {
      clearTimeout(syncTimer);
      syncTimer = setTimeout(syncSchedule, 800);
    };

    async function pollFeed() {
      try {
        const now = getNow();
        const params = new URLSearchParams({ deviceId: getDeviceId() });
        if (isTestNowActive()) params.set("now", now.toISOString());
        const res = await fetch(`/api/share?${params}`);
        if (!res.ok) return;
        const { items } = (await res.json()) as { items: SharedFeedItem[] };
        if (disposed) return;
        const prev = JSON.stringify(readJSON(STORAGE_KEYS.sharedFeed, []));
        if (prev !== JSON.stringify(items)) writeJSON(STORAGE_KEYS.sharedFeed, items);
        deliverDue();
      } catch {
        // 오프라인 등: 다음 주기에 다시 시도
      }
    }

    /** 앱 안 알림센터 전달 (+ 기기 알림) */
    function deliverDue() {
      const now = getNow();
      const testMode = isTestNowActive();
      // 푸시를 받는 기기는 서버가 보내므로 기기 알림은 띄우지 않고 알림센터에만 넣습니다 (테스트 시각일 때는 직접 띄움)
      const showSystem = !pushActive || testMode;
      const delivered = deliveredKeys();

      // A·B: 지금 기준으로 계산합니다 (이미 지난 A는 행사 시작 전이면 지금 보내고, 시작했으면 보내지 않음).
      // 귀가 시간(B)은 앱이 잠깐 꺼져 있었어도 놓치지 않도록 '지금-10분' 기준 계산에서 함께 찾습니다.
      const current = computeMessages(loadPlanInput(now));
      const keys = new Set(current.map((m) => m.key));
      const recentGoHome = computeMessages(loadPlanInput(new Date(now.getTime() - DUE_WINDOW_MS))).filter(
        (m) => m.kind === "atGoHome" && !keys.has(m.key),
      );
      for (const m of [...current, ...recentGoHome]) {
        const at = new Date(m.notifyAt).getTime();
        if (at > now.getTime() || at < now.getTime() - DUE_WINDOW_MS || delivered.has(m.key)) continue;
        if (new Date(m.expiresAt).getTime() <= now.getTime()) continue; // 행사가 이미 시작함
        if (addToInbox(m, now) && showSystem) showLocalNotification(m.title, m.body, m.url, m.key);
      }

      // C: 같은 학과 학생이 공유한 촉박한 행사
      if (!settings().deptUrgent.enabled) return;
      for (const f of readJSON<SharedFeedItem[]>(STORAGE_KEYS.sharedFeed, [])) {
        if (f.mine || !f.urgentSentAt) continue;
        const key = `deptUrgent:${f.id}`;
        if (delivered.has(key)) continue;
        // 너무 오래된 C(하루 이상)는 알림센터에 넣지 않습니다
        if (now.getTime() - new Date(f.urgentSentAt).getTime() > 24 * 60 * 60_000) continue;
        const { title, body } = urgentMessage(f);
        const url = `/event/shared-${f.id}`;
        if (addToInbox({ key, kind: "deptUrgent", title, body, url }, now) && showSystem) {
          showLocalNotification(title, body, url, key);
        }
      }
    }

    const onStorage = (e: Event) => {
      const key = (e as CustomEvent<StorageKey>).detail;
      if (SCHEDULE_KEYS.includes(key)) scheduleSync();
      if (key === STORAGE_KEYS.profile) {
        scheduleSync();
        pollFeed();
      }
      if (key === STORAGE_KEYS.testNow) pollFeed();
    };

    syncSchedule().then(pollFeed);
    window.addEventListener(STORAGE_EVENT, onStorage);
    window.addEventListener(REFRESH_FEED_EVENT, pollFeed);
    const tick = setInterval(deliverDue, TICK_MS);
    const feedTimer = setInterval(pollFeed, FEED_POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && pollFeed();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      disposed = true;
      clearTimeout(syncTimer);
      clearInterval(tick);
      clearInterval(feedTimer);
      window.removeEventListener(STORAGE_EVENT, onStorage);
      window.removeEventListener(REFRESH_FEED_EVENT, pollFeed);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
