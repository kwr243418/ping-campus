// 학과 공유 요청 (브라우저 전용)
import { getNow, isTestNowActive } from "../dates";
import type { Grade, ShareScope, ShareableFields } from "../share";
import { getDeviceId, postJSON, registerDevice } from "./device";

/** 화면에서 피드를 바로 다시 받고 싶을 때 보내는 이벤트 (AppRuntime이 받음) */
export const REFRESH_FEED_EVENT = "ping-campus:refresh-feed";

export function refreshFeed() {
  window.dispatchEvent(new Event(REFRESH_FEED_EVENT));
}

/** 테스트 모드 시각이 켜져 있으면 서버 판단에도 그 시각을 씁니다(데모 도구가 켜진 서버에서만 반영) */
const testNow = () => (isTestNowActive() ? getNow().toISOString() : undefined);

export interface ShareResult {
  sharedEventId: string;
  merged: boolean;
  registrantCount: number;
  urgentSent: boolean;
  urgentLimited?: boolean;
  recipients: number;
}

export async function shareEvent(fields: ShareableFields, scope: ShareScope, grades: Grade[]): Promise<ShareResult> {
  await registerDevice();
  const result = await postJSON<ShareResult>("/api/share", {
    deviceId: getDeviceId(),
    scope,
    grades,
    event: fields,
    now: testNow(),
  });
  refreshFeed();
  return result;
}

export async function reportShared(sharedEventId: string): Promise<{ hidden: boolean }> {
  const r = await postJSON<{ hidden: boolean }>("/api/share/report", { deviceId: getDeviceId(), sharedEventId });
  refreshFeed();
  return r;
}

export async function demoFriendShare(): Promise<ShareResult & { title: string; startTime: string }> {
  await registerDevice();
  const r = await postJSON<ShareResult & { title: string; startTime: string }>("/api/share/demo-friend", {
    deviceId: getDeviceId(),
    now: testNow(),
  });
  refreshFeed();
  return r;
}
