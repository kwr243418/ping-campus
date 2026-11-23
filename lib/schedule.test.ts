// PRD FR-7 테스트 표 10개를 그대로 옮긴 테스트입니다.
import { describe, expect, it } from "vitest";
import { atSeoul, toTimeString } from "./dates";
import { compareWithTimetable, getGoHomeTime, planNotifications } from "./schedule";
import {
  DEFAULT_NOTIFY_SETTINGS,
  type Event,
  type NotifySettings,
  type PlannedNotification,
  type Timetable,
} from "./types";

const DATE = "2026-11-23"; // 월요일
const NOW = atSeoul(DATE, "08:00");

/** 월요일 수업 1개가 goHome에 끝나는 시간표 */
function timetableEndingAt(goHome: string): Timetable {
  return {
    semesterStart: "2026-09-01",
    semesterEnd: "2026-12-21",
    classes: [{ id: "c1", weekday: 1, start: "09:00", end: goHome }],
    exceptions: [],
  };
}

function event(id: string, startTime?: string): Event {
  return {
    id,
    title: `행사 ${id}`,
    date: DATE,
    startTime,
    category: "lecture",
    source: "kakao",
    missingFields: startTime ? [] : ["startTime"],
    createdAt: "2026-11-20T00:00:00Z",
  };
}

type Summary = { A: string[]; B: string[]; mergedIntoB: string[] };

function summarize(list: PlannedNotification[]): Summary {
  return {
    A: list.filter((n) => n.kind === "beforeEvent").map((n) => toTimeString(n.notifyAt)),
    B: list.filter((n) => n.kind === "atGoHome").map((n) => toTimeString(n.notifyAt)),
    mergedIntoB: list.flatMap((n) => n.mergedBeforeEventIds ?? []),
  };
}

function plan(
  timetable: Timetable | null,
  events: Event[],
  settings: NotifySettings = DEFAULT_NOTIFY_SETTINGS,
) {
  return planNotifications(DATE, events, timetable, settings, NOW);
}

describe("FR-7 알림 판단 표", () => {
  it("1. 수업 후 여유 있음: 귀가 15:00, 시작 18:00 → A 17:00, B 15:00", () => {
    expect(summarize(plan(timetableEndingAt("15:00"), [event("e1", "18:00")]))).toEqual({
      A: ["17:00"],
      B: ["15:00"],
      mergedIntoB: [],
    });
  });

  it("2. 수업 직후 시작: 귀가 16:30, 시작 17:00 → A 16:00, B 16:30", () => {
    expect(summarize(plan(timetableEndingAt("16:30"), [event("e1", "17:00")]))).toEqual({
      A: ["16:00"],
      B: ["16:30"],
      mergedIntoB: [],
    });
  });

  it("3. 귀가 시간 = 1시간 전: 귀가 16:00, 시작 17:00 → B 16:00 1건으로 합침", () => {
    expect(summarize(plan(timetableEndingAt("16:00"), [event("e1", "17:00")]))).toEqual({
      A: [],
      B: ["16:00"],
      mergedIntoB: ["e1"],
    });
  });

  it("4. 수업 종료와 동시 시작: 귀가 16:30, 시작 16:30 → A 15:30, B 없음", () => {
    expect(summarize(plan(timetableEndingAt("16:30"), [event("e1", "16:30")]))).toEqual({
      A: ["15:30"],
      B: [],
      mergedIntoB: [],
    });
  });

  it("5. 수업과 겹침: 귀가 18:00, 시작 17:00 → A 16:00, B 없음", () => {
    const tt = timetableEndingAt("18:00");
    expect(summarize(plan(tt, [event("e1", "17:00")]))).toEqual({
      A: ["16:00"],
      B: [],
      mergedIntoB: [],
    });
    expect(compareWithTimetable(event("e1", "17:00"), tt).kind).toBe("overlap");
  });

  it("6. 수업 없는 날: 귀가 없음, 시작 17:00 → A 16:00, B 없음", () => {
    const tt: Timetable = { ...timetableEndingAt("15:00"), classes: [] };
    expect(getGoHomeTime(DATE, tt)).toBeNull();
    expect(summarize(plan(tt, [event("e1", "17:00")]))).toEqual({
      A: ["16:00"],
      B: [],
      mergedIntoB: [],
    });
  });

  it("7. 휴강으로 마지막 수업이 앞당겨짐: 귀가 13:00(예외 반영), 시작 15:00 → A 14:00, B 13:00", () => {
    const tt: Timetable = {
      semesterStart: "2026-09-01",
      semesterEnd: "2026-12-21",
      classes: [
        { id: "c1", weekday: 1, start: "10:00", end: "13:00" },
        { id: "c2", weekday: 1, start: "15:00", end: "17:00" },
      ],
      exceptions: [{ date: DATE, type: "cancel", classId: "c2" }],
    };
    expect(getGoHomeTime(DATE, tt)).toBe("13:00");
    expect(summarize(plan(tt, [event("e1", "15:00")]))).toEqual({
      A: ["14:00"],
      B: ["13:00"],
      mergedIntoB: [],
    });
  });

  it("8. 같은 날 귀가 후 행사 2개: 귀가 15:00, 시작 17:00·19:00 → A 16:00·18:00, B 15:00 묶음 1건", () => {
    const list = plan(timetableEndingAt("15:00"), [event("e1", "17:00"), event("e2", "19:00")]);
    expect(summarize(list)).toEqual({ A: ["16:00", "18:00"], B: ["15:00"], mergedIntoB: [] });
    expect(list.find((n) => n.kind === "atGoHome")?.eventIds).toEqual(["e1", "e2"]);
  });

  it("9. 알림 B 꺼짐: 귀가 15:00, 시작 18:00 → A 17:00, B 없음", () => {
    const settings: NotifySettings = { ...DEFAULT_NOTIFY_SETTINGS, atGoHome: { enabled: false } };
    expect(summarize(plan(timetableEndingAt("15:00"), [event("e1", "18:00")], settings))).toEqual({
      A: ["17:00"],
      B: [],
      mergedIntoB: [],
    });
  });

  it("10. 시작 시각 없음: 귀가 15:00 → A·B 없음, '시간 확인 필요'", () => {
    const tt = timetableEndingAt("15:00");
    expect(plan(tt, [event("e1")])).toEqual([]);
    expect(compareWithTimetable(event("e1"), tt).kind).toBe("noTime");
  });
});

describe("지난 알림 처리 (FR-7 A)", () => {
  it("1시간 전이 지났지만 시작 전이면 즉시 보낸다", () => {
    const now = atSeoul(DATE, "16:30");
    const list = planNotifications(DATE, [event("e1", "17:00")], null, DEFAULT_NOTIFY_SETTINGS, now);
    expect(list).toHaveLength(1);
    expect(list[0].notifyAt).toEqual(now);
  });

  it("이미 시작했으면 보내지 않는다", () => {
    const now = atSeoul(DATE, "17:10");
    expect(planNotifications(DATE, [event("e1", "17:00")], null, DEFAULT_NOTIFY_SETTINGS, now)).toEqual([]);
  });
});
