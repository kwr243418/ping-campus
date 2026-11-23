// 기기 저장소(localStorage) 래퍼. 저장소 접근은 반드시 이 파일을 거칩니다.
const PREFIX = "ping-campus:";

export const STORAGE_KEYS = {
  seeded: "seeded", // 데모 데이터를 넣었는지
  onboarded: "onboarded", // 첫 실행 온보딩(S01)을 마쳤는지
  timetable: "timetable",
  events: "events",
  addedEventIds: "addedEventIds",
  notifySettings: "notifySettings",
  interestCategories: "interestCategories",
  profile: "profile", // 학과·학년
  testNow: "testNow", // 테스트 모드 '현재 시각 바꾸기' (ISO 문자열)
  deviceId: "deviceId", // 익명 기기 ID (UUID)
  inbox: "inbox", // 앱 안 알림센터(S10)
  deliveredKeys: "deliveredKeys", // 앱 안에서 이미 띄운 알림 키
  sharedFeed: "sharedFeed", // 우리 학과 피드 캐시 (FR-11)
  dismissedIds: "dismissedIds", // '관심 없음'으로 숨긴 행사
} as const;

/** 저장값이 바뀌면 같은 탭의 다른 컴포넌트(알림 동기화 등)에 알립니다 */
export const STORAGE_EVENT = "ping-campus:storage";

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

export function readJSON<T>(key: StorageKey, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeJSON<T>(key: StorageKey, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent(STORAGE_EVENT, { detail: key }));
  } catch {
    // 저장 공간 부족·사생활 보호 모드 등은 무시하고 메모리 상태로만 동작합니다.
  }
}

export function removeKey(key: StorageKey): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PREFIX + key);
    window.dispatchEvent(new CustomEvent(STORAGE_EVENT, { detail: key }));
  } catch {
    // 무시
  }
}

export function clearAll(): void {
  for (const key of Object.values(STORAGE_KEYS)) removeKey(key);
}
