// PRD §8 데이터 모델

export type Source = "kakao" | "homepage" | "everytime" | "offline" | "link" | "other";
export type Category = "lecture" | "career" | "scholarship" | "contest" | "dept" | "club" | "etc";
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6; // 월~토

export const CATEGORY_LABEL: Record<Category, string> = {
  lecture: "특강",
  career: "채용",
  scholarship: "장학",
  contest: "공모전",
  dept: "학과행사",
  club: "동아리",
  etc: "기타",
};

export interface ClassBlock {
  id: string;
  weekday: Weekday;
  start: string; // HH:mm
  end: string; // HH:mm
  name?: string;
  room?: string;
}

export interface TimetableException {
  date: string; // YYYY-MM-DD
  type: "cancel" | "makeup" | "holiday" | "override";
  classId?: string; // cancel 대상
  start?: string; // makeup 블록
  end?: string;
  goHomeTime?: string; // override: 귀가 시간 직접 지정
}

export interface Timetable {
  semesterStart: string; // YYYY-MM-DD
  semesterEnd: string;
  classes: ClassBlock[];
  exceptions: TimetableException[];
}

export type MissingField = "date" | "startTime" | "location";

export interface Event {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime?: string; // HH:mm
  endTime?: string;
  location?: string;
  organizer?: string;
  category: Category;
  target?: string;
  applyUrl?: string;
  applyDeadline?: string;
  summary?: string;
  source: Source;
  rawText?: string; // 마스킹 후 저장
  missingFields: MissingField[];
  createdAt: string;
  sharedEventId?: string; // 공유했거나 공유받은 행사 (FR-11)
  sharedOrigin?: "student" | "homepage"; // 공유받은 행사의 출처 (홈페이지 공용 피드는 관심 분야일 때만 알림)
}

export interface NotifySettings {
  beforeEvent: { enabled: boolean; leadMinutes: 30 | 60 | 90 }; // 알림 A
  atGoHome: { enabled: boolean }; // 알림 B
  deptUrgent: { enabled: boolean }; // 알림 C
  mutedCategories: Category[];
}

export const DEFAULT_NOTIFY_SETTINGS: NotifySettings = {
  beforeEvent: { enabled: true, leadMinutes: 60 },
  atGoHome: { enabled: true },
  deptUrgent: { enabled: true },
  mutedCategories: [],
};

export type PlannedNotification = {
  kind: "beforeEvent" | "atGoHome" | "deptUrgent";
  notifyAt: Date;
  eventIds: string[]; // atGoHome은 여러 행사를 묶을 수 있음
  /** B에 합쳐진 A의 행사 ID (10분 이내 중복 정리) */
  mergedBeforeEventIds?: string[];
};
