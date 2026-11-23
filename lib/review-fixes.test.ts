// P9 검토에서 찾은 문제의 회귀 테스트
import { describe, expect, it } from "vitest";
import { atSeoul } from "./dates";
import { buildIcs, foldLine } from "./ics";
import { buildMessage, notificationKey } from "./notifyMessages";
import { planNotifications } from "./schedule";
import { canReport, isWithinUrgentLimit, suggestScope, widenScope, type SharedRecord } from "./share";
import { DEFAULT_NOTIFY_SETTINGS, type Event } from "./types";

const ev = (over: Partial<Event> = {}): Event => ({
  id: "e1",
  title: "AI 특강",
  date: "2026-11-24",
  startTime: "15:00",
  location: "공학관 105",
  category: "lecture",
  source: "manual" as Event["source"],
  missingFields: [],
  createdAt: "2026-11-20T00:00:00.000Z",
  ...over,
});

const rec = (over: Partial<SharedRecord> = {}): SharedRecord => ({
  id: "s1",
  title: "AI 특강",
  date: "2026-11-24",
  startTime: "17:00",
  endTime: null,
  location: null,
  category: "lecture",
  applyUrl: null,
  departmentCode: "CSE",
  scope: "grade",
  grades: [3],
  registrantDeviceIds: ["a"],
  reportDeviceIds: [],
  hidden: false,
  isUrgent: false,
  urgentSentAt: null,
  createdAt: "2026-11-24T00:00:00.000Z",
  ...over,
});

describe("알림 키·만료", () => {
  it("행사 날짜·시간을 바꾸면 A의 키가 달라진다 (다시 알림)", () => {
    const a = ev();
    const b = ev({ date: "2026-11-25" });
    const plan = { kind: "beforeEvent" as const, notifyAt: new Date(), eventIds: ["e1"] };
    expect(notificationKey(plan, [a])).not.toBe(notificationKey(plan, [b]));
    expect(notificationKey(plan, [a])).toBe(notificationKey({ ...plan, notifyAt: new Date(0) }, [a]));
  });

  it("이미 시작한 행사에는 A를 만들지 않고, 늦게 추가한 A는 남은 시간으로 알린다", () => {
    const e = ev();
    const started = planNotifications(e.date, [e], null, DEFAULT_NOTIFY_SETTINGS, atSeoul(e.date, "15:05"));
    expect(started).toEqual([]);
    const late = planNotifications(e.date, [e], null, DEFAULT_NOTIFY_SETTINGS, atSeoul(e.date, "14:40"));
    const msg = buildMessage(late[0], new Map([[e.id, e]]), 60)!;
    expect(msg.title).toContain("20분 뒤 시작");
    expect(msg.expiresAt).toBe(atSeoul(e.date, "15:00").toISOString());
  });
});

describe("공유 범위·신고·한도", () => {
  it("'3학년 전체'는 3학년 범위다", () => {
    expect(suggestScope("3학년 전체", 2)).toEqual({ scope: "grade", grades: [3] });
    expect(suggestScope("학과 전체", 2)).toEqual({ scope: "department", grades: [] });
    expect(suggestScope("전체 학생", 2)).toEqual({ scope: "department", grades: [] });
  });

  it("다른 학년이 같은 행사를 공유하면 범위를 넓힌다", () => {
    expect(widenScope({ scope: "grade", grades: [3] }, { scope: "grade", grades: [1] })).toEqual({
      scope: "grade",
      grades: [1, 3],
      changed: true,
    });
    expect(widenScope({ scope: "grade", grades: [3] }, { scope: "grade", grades: [3] }).changed).toBe(false);
    expect(widenScope({ scope: "grade", grades: [3] }, { scope: "department", grades: [] }).scope).toBe("department");
  });

  it("등록되지 않았거나 범위 밖이거나 등록자 본인인 기기는 신고할 수 없다", () => {
    const r = rec();
    expect(canReport(null, r)).toBe(false);
    expect(canReport({ id: "x", departmentCode: "ENG", grade: 3 }, r)).toBe(false);
    expect(canReport({ id: "x", departmentCode: "CSE", grade: 1 }, r)).toBe(false);
    expect(canReport({ id: "a", departmentCode: "CSE", grade: 3 }, r)).toBe(false);
    expect(canReport({ id: "x", departmentCode: "CSE", grade: 3 }, r)).toBe(true);
  });

  it("동시에 발송 시각을 기록한 C는 이른 3건만 보낸다", () => {
    const now = atSeoul("2026-11-24", "12:00");
    const t = now.toISOString();
    const list = ["s1", "s2", "s3", "s4"].map((id) => rec({ id, urgentSentAt: t }));
    expect(isWithinUrgentLimit(list, "s3", "CSE", now)).toBe(true);
    expect(isWithinUrgentLimit(list, "s4", "CSE", now)).toBe(false);
  });
});

describe(".ics", () => {
  it("세미콜론·쉼표를 이스케이프하고 75바이트로 줄을 접는다", () => {
    const ics = buildIcs([ev({ title: "특강; 2부, 질의응답", location: "공학관 105; 3층" })], new Date(0));
    expect(ics).toContain("SUMMARY:특강\\; 2부\\, 질의응답");
    expect(ics).toContain("LOCATION:공학관 105\\; 3층");
    const long = foldLine("DESCRIPTION:" + "가".repeat(60));
    for (const line of long.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(long.split("\r\n").map((l, i) => (i ? l.slice(1) : l)).join("")).toBe("DESCRIPTION:" + "가".repeat(60));
  });
});
