// PRD FR-11 테스트 표 12개를 그대로 옮긴 테스트입니다.
import { describe, expect, it } from "vitest";
import { atSeoul, toTimeString } from "./dates";
import { planNotifications } from "./schedule";
import {
  addRegistrant,
  applyReport,
  canSeeInFeed,
  decideShare,
  defaultShareOn,
  isUrgent,
  mergeWithUrgent,
  selectUrgentRecipients,
  suggestScope,
  type DeviceInfo,
  type SharedRecord,
  type ShareableFields,
} from "./share";
import { DEFAULT_NOTIFY_SETTINGS, type Event } from "./types";

const TODAY = "2026-11-23";
const at = (time: string, date = TODAY) => atSeoul(date, time);

const card = (over: Partial<ShareableFields> = {}): ShareableFields => ({
  title: "AI 커리어 특강",
  date: TODAY,
  startTime: "17:00",
  endTime: null,
  location: "인문관 301",
  category: "lecture",
  applyUrl: null,
  ...over,
});

const device = (id: string, over: Partial<DeviceInfo> = {}): DeviceInfo => ({
  id,
  departmentCode: "CSE",
  grade: 3,
  urgentEnabled: true,
  ...over,
});

let seq = 0;
function record(over: Partial<SharedRecord> = {}): SharedRecord {
  return {
    ...card(),
    id: `s${++seq}`,
    departmentCode: "CSE",
    scope: "grade",
    grades: [3],
    registrantDeviceIds: ["me"],
    reportDeviceIds: [],
    hidden: false,
    isUrgent: true,
    urgentSentAt: null,
    createdAt: at("11:00").toISOString(),
    ...over,
  };
}

describe("FR-11 공유 판단 표", () => {
  it("1. 촉박한 당일 행사: 11:00 등록, 17:00 시작 → 공유 자동 켜짐, 같은 학과·학년에 C 즉시 발송", () => {
    const now = at("11:00");
    expect(isUrgent(card(), now)).toBe(true);
    expect(defaultShareOn(card(), now)).toBe(true);
    const decision = decideShare({ candidate: card(), device: device("me"), existing: [], now });
    expect(decision).toEqual({ kind: "created", isUrgent: true, sendUrgent: true });
    const shared = record({ registrantDeviceIds: ["me"] });
    expect(selectUrgentRecipients(shared, [device("me"), device("friend")]).map((d) => d.id)).toEqual(["friend"]);
  });

  it("2. 촉박하지 않은 당일 행사: 09:00 등록, 17:00 시작(8시간) → 공유 기본 꺼짐, 켜면 피드에만", () => {
    const now = at("09:00");
    expect(defaultShareOn(card(), now)).toBe(false);
    expect(decideShare({ candidate: card(), device: device("me"), existing: [], now })).toEqual({
      kind: "created",
      isUrgent: false,
      sendUrgent: false,
    });
    expect(canSeeInFeed(device("friend"), record({ isUrgent: false }))).toBe(true);
  });

  it("3. 내일 행사 → 촉박하지 않음, C 없음", () => {
    const tomorrow = card({ date: "2026-11-24" });
    expect(isUrgent(tomorrow, at("16:00"))).toBe(false);
    expect(decideShare({ candidate: tomorrow, device: device("me"), existing: [], now: at("16:00") })).toMatchObject({
      sendUrgent: false,
    });
  });

  it("4. 이미 시작한 행사: 17:10 등록, 17:00 시작 → 공유는 가능, C 없음", () => {
    expect(decideShare({ candidate: card(), device: device("me"), existing: [], now: at("17:10") })).toEqual({
      kind: "created",
      isUrgent: false,
      sendUrgent: false,
    });
  });

  it("5. 같은 행사 두 번째 등록 → 합쳐서 '2명이 등록', C 다시 보내지 않음", () => {
    const first = record({ urgentSentAt: at("11:00").toISOString() });
    const decision = decideShare({
      candidate: card({ title: "[공지] AI 커리어 특강 안내", startTime: "17:10" }),
      device: device("friend"),
      existing: [first],
      now: at("12:00"),
    });
    expect(decision).toMatchObject({ kind: "merged", targetId: first.id, sendUrgent: false });
    expect(addRegistrant(first, "friend")).toHaveLength(2);
  });

  it("6. 다른 학과 학생 → 알림·피드 없음", () => {
    const other = device("other", { departmentCode: "BIZ" });
    const shared = record();
    expect(canSeeInFeed(other, shared)).toBe(false);
    expect(selectUrgentRecipients(shared, [other])).toEqual([]);
  });

  it("7. 같은 학과 다른 학년, 범위 '내 학년': 3학년 등록, 2학년 수신자 → 알림 없음", () => {
    const second = device("second", { grade: 2 });
    expect(selectUrgentRecipients(record({ scope: "grade", grades: [3] }), [second])).toEqual([]);
  });

  it("8. 같은 학과 다른 학년, 범위 '학과 전체': 3학년 등록, 2학년 수신자 → C 받음", () => {
    const second = device("second", { grade: 2 });
    expect(selectUrgentRecipients(record({ scope: "department", grades: [] }), [second])).toEqual([second]);
  });

  it("9. 등록자 본인 → C 받지 않음", () => {
    expect(selectUrgentRecipients(record({ registrantDeviceIds: ["me"] }), [device("me")])).toEqual([]);
  });

  it("10. C와 A가 10분 이내: 16:05 등록, 17:00 시작 → A 16:00(지남)·C 16:05 → C 1건만", () => {
    const now = at("16:05");
    const ev: Event = {
      id: "shared-s1",
      title: "AI 커리어 특강",
      date: TODAY,
      startTime: "17:00",
      category: "lecture",
      source: "other",
      missingFields: [],
      createdAt: now.toISOString(),
      sharedEventId: "s1",
    };
    const plans = planNotifications(TODAY, [ev], null, DEFAULT_NOTIFY_SETTINGS, now);
    expect(plans.map((p) => `${p.kind}@${toTimeString(p.notifyAt)}`)).toEqual(["beforeEvent@16:05"]);
    expect(mergeWithUrgent(plans, [{ eventId: ev.id, at: now }])).toEqual([]);
  });

  it("11. 신고 2건: 서로 다른 기기 2대가 신고 → 피드에서 숨김", () => {
    const shared = record();
    const once = applyReport(shared, "a");
    expect(once.hidden).toBe(false);
    expect(applyReport({ ...shared, ...once }, "a").hidden).toBe(false); // 같은 기기 중복 신고는 1건
    const twice = applyReport({ ...shared, ...once }, "b");
    expect(twice).toMatchObject({ hidden: true, becameHidden: true });
    expect(canSeeInFeed(device("friend"), { ...shared, ...twice })).toBe(false);
  });

  it("12. 하루 C 3건 초과: 같은 학과 4번째 촉박 행사 → 피드에만 등록, C 없음", () => {
    const sent = [1, 2, 3].map((i) =>
      record({ title: `행사 ${i}번`, startTime: `1${i}:00`, urgentSentAt: at("10:00").toISOString(), registrantDeviceIds: [`d${i}`] }),
    );
    expect(
      decideShare({ candidate: card({ title: "완전히 다른 네 번째 설명회" }), device: device("me"), existing: sent, now: at("12:00") }),
    ).toEqual({ kind: "created", isUrgent: true, sendUrgent: false });
  });
});

describe("공유 범위 자동 선택", () => {
  it("대상 문구로 범위를 고른다", () => {
    expect(suggestScope("3학년 대상", 2)).toEqual({ scope: "grade", grades: [3] });
    expect(suggestScope("전 학년", 2)).toEqual({ scope: "department", grades: [] });
    expect(suggestScope("1~2학년", 3)).toEqual({ scope: "grade", grades: [1, 2] });
    expect(suggestScope(null, 2)).toEqual({ scope: "grade", grades: [2] });
    expect(suggestScope(undefined, null)).toEqual({ scope: "department", grades: [] });
  });
});

describe("공유 횟수 제한", () => {
  it("기기당 하루 5건을 넘으면 거절", () => {
    const mine = [1, 2, 3, 4, 5].map((i) => record({ title: `내가 올린 ${i}`, startTime: `0${i}:00`, registrantDeviceIds: ["me"] }));
    expect(
      decideShare({ candidate: card({ title: "여섯 번째 공유 행사" }), device: device("me"), existing: mine, now: at("12:00") }),
    ).toEqual({ kind: "rejected", reason: "daily-limit" });
  });
});
