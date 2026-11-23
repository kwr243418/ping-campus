import { describe, expect, it } from "vitest";
import { parseNoticeFallback } from "./fallbackParser";
import { MASK, maskPersonalInfo } from "./mask";

const BASE = "2026-11-18"; // 수요일

describe("maskPersonalInfo", () => {
  it("전화번호·이메일·학번을 가린다", () => {
    const out = maskPersonalInfo("문의 010-1234-5678 / test.user@example.ac.kr / 학번 20261234");
    expect(out).toBe(`문의 ${MASK} / ${MASK} / 학번 ${MASK}`);
  });
  it("카톡 발신자 이름을 가린다", () => {
    expect(maskPersonalInfo("[김학생] [오후 3:12] 오늘 특강 있어요")).toBe(`${MASK} [오후 3:12] 오늘 특강 있어요`);
    expect(maskPersonalInfo("2026년 11월 18일 오후 3:12, 김학생 : 공지입니다")).toBe(
      `2026년 11월 18일 오후 3:12, ${MASK} : 공지입니다`,
    );
  });
  it("날짜·시간은 그대로 둔다", () => {
    expect(maskPersonalInfo("2026.11.20 17:00 인문관 301")).toBe("2026.11.20 17:00 인문관 301");
  });
});

describe("parseNoticeFallback", () => {
  it("라벨이 있는 공지", () => {
    const e = parseNoticeFallback(
      "[공지] AI 커리어 특강\n일시: 11월 20일(금) 오후 5시~7시\n장소: 인문관 301호\n대상: 전 학년\n신청 마감: 11월 19일 18:00",
      BASE,
    );
    expect(e).toMatchObject({
      title: "AI 커리어 특강",
      date: "2026-11-20",
      startTime: "17:00",
      endTime: "19:00",
      location: "인문관 301호",
      category: "lecture",
      target: "전 학년",
    });
  });
  it("상대 날짜·24시간제·장소 없음", () => {
    const e = parseNoticeFallback("내일 17:30부터 학과 간담회 진행합니다! 약 2시간 진행", BASE);
    expect(e.date).toBe("2026-11-19");
    expect(e.startTime).toBe("17:30");
    expect(e.location).toBeNull();
    expect(e.category).toBe("dept");
  });
  it("연도 없는 지난 날짜는 내년으로", () => {
    expect(parseNoticeFallback("3/5(목) 14:00 공학관 105 공모전 설명회", BASE).date).toBe("2027-03-05");
  });
  it("카톡 타임스탬프를 행사 시간으로 쓰지 않는다", () => {
    const e = parseNoticeFallback("[오후 3:12] 이번 주 금요일 6시 학생회관 대강당 동아리 공연", BASE);
    expect(e.startTime).toBe("18:00");
    expect(e.date).toBe("2026-11-20");
    expect(e.location).toContain("학생회관");
  });
});

describe("parseNoticeFallback 제목", () => {
  it("발신자·타임스탬프·[공지] 꼬리표를 제목에서 뺀다", () => {
    const e = parseNoticeFallback("[마스킹] [오후 3:12] [공지] 졸업생 초청 진로 특강\n일시: 11월 20일 17:00", BASE);
    expect(e.title).toBe("졸업생 초청 진로 특강");
  });
});

describe("parseNoticeFallback 제목 앞 날짜·시간", () => {
  it("제목 앞의 '오늘 08:30'을 뺀다", () => {
    expect(parseNoticeFallback("[공지] 오늘 08:30 학과 긴급 특강\n장소: 공학관 105", BASE).title).toBe("학과 긴급 특강");
    expect(parseNoticeFallback("11/20(금) 오후 5시 진로 특강 안내", BASE).title).toBe("진로 특강 안내");
  });
});
