// M1 목업 데이터. 날짜는 '오늘' 기준으로 만들어 언제 열어도 이번 주 행사로 보이게 합니다.
// (M2 이후 시간표·행사는 기기 저장소에서 읽습니다.)
import { nextWeekday } from "./dates";
import type { Category, Event, Timetable } from "./types";

/** 마지막 수업 종료: 월 15:00, 화 16:30, 수 18:00, 목 13:00 (금·토 수업 없음) */
export const MOCK_TIMETABLE: Timetable = {
  semesterStart: "2026-09-01",
  semesterEnd: "2026-12-21",
  classes: [
    { id: "mon-1", weekday: 1, start: "10:30", end: "12:00", name: "인간컴퓨터상호작용", room: "공학관 401" },
    { id: "mon-2", weekday: 1, start: "13:30", end: "15:00", name: "데이터베이스", room: "공학관 305" },
    { id: "tue-1", weekday: 2, start: "15:00", end: "16:30", name: "운영체제", room: "공학관 210" },
    { id: "wed-1", weekday: 3, start: "09:00", end: "10:30", name: "인간컴퓨터상호작용", room: "공학관 401" },
    { id: "wed-2", weekday: 3, start: "16:30", end: "18:00", name: "캡스톤디자인", room: "공학관 501" },
    { id: "thu-1", weekday: 4, start: "10:30", end: "13:00", name: "소프트웨어공학", room: "공학관 305" },
  ],
  exceptions: [],
};

/** 온보딩에서 고른 관심 카테고리 (장학·동아리는 관심 밖 → '일정에 추가'해야 알림 대상) */
export const MOCK_INTEREST_CATEGORIES: Category[] = ["lecture", "career", "contest", "dept"];

export function getMockEvents(today: string): Event[] {
  const createdAt = `${today}T00:00:00+09:00`;
  return [
    {
      id: "mock-1",
      title: "AI 시대의 커리어 설계 특강",
      date: nextWeekday(today, 1),
      startTime: "18:00",
      endTime: "20:00",
      location: "인문관 301",
      organizer: "진로취업센터",
      category: "lecture",
      source: "kakao",
      missingFields: [],
      createdAt,
    },
    {
      id: "mock-2",
      title: "2026 하반기 IT 기업 채용설명회",
      date: nextWeekday(today, 2),
      startTime: "17:00",
      endTime: "18:30",
      location: "학생회관 대강당",
      organizer: "대학일자리플러스센터",
      category: "career",
      source: "homepage",
      missingFields: [],
      createdAt,
    },
    {
      id: "mock-3",
      title: "교내 장학금 신청 설명회",
      date: nextWeekday(today, 3),
      startTime: "17:00",
      endTime: "18:00",
      location: "본관 2층 회의실",
      organizer: "학생지원팀",
      category: "scholarship",
      source: "homepage",
      missingFields: [],
      createdAt,
    },
    {
      id: "mock-4",
      title: "캡스톤 아이디어 공모전 설명회",
      date: nextWeekday(today, 4),
      startTime: "15:00",
      endTime: "16:30",
      location: "공학관 105",
      organizer: "공과대학 학생회",
      category: "contest",
      source: "offline",
      missingFields: [],
      createdAt,
    },
    {
      id: "mock-5",
      title: "밴드 동아리 가을 정기 공연",
      date: nextWeekday(today, 5),
      startTime: "17:00",
      endTime: "19:00",
      location: "학생회관 소극장",
      organizer: "중앙 밴드 동아리",
      category: "club",
      source: "everytime",
      missingFields: [],
      createdAt,
    },
    {
      id: "mock-6",
      title: "학과 선배와의 진로 멘토링",
      date: today,
      startTime: "19:30",
      endTime: "21:00",
      // 장소가 공지에 없음 → '확인 필요' 배지
      organizer: "컴퓨터공학과 학생회",
      category: "dept",
      source: "kakao",
      missingFields: ["location"],
      createdAt,
    },
  ];
}
