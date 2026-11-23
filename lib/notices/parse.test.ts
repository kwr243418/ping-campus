import { describe, expect, it } from "vitest";
import { isAllowedByRobots, looksLikeEvent, parseFeed, parseListHtml } from "./parse";

describe("robots.txt", () => {
  const robots = "User-agent: *\nDisallow: /admin\nAllow: /admin/public\n\nUser-agent: BadBot\nDisallow: /";
  it("Disallow·Allow 규칙을 따른다", () => {
    expect(isAllowedByRobots(robots, "/board/notice")).toBe(true);
    expect(isAllowedByRobots(robots, "/admin/secret")).toBe(false);
    expect(isAllowedByRobots(robots, "/admin/public/list")).toBe(true);
    expect(isAllowedByRobots("User-agent: *\nDisallow: /", "/board")).toBe(false);
    expect(isAllowedByRobots("", "/board")).toBe(true);
  });
});

describe("공지 목록 파싱", () => {
  it("RSS", () => {
    const xml = `<rss><channel><item><title><![CDATA[2026 진로 특강 안내]]></title><link>/bbs/view?no=101</link><pubDate>Mon, 23 Nov 2026 09:00:00 +0900</pubDate><description>&lt;p&gt;일시: 11월 25일 오후 5시&lt;/p&gt;</description></item></channel></rss>`;
    const items = parseFeed(xml, "https://www.example.ac.kr/");
    expect(items).toEqual([
      {
        title: "2026 진로 특강 안내",
        url: "https://www.example.ac.kr/bbs/view?no=101",
        publishedAt: "Mon, 23 Nov 2026 09:00:00 +0900",
        description: "일시: 11월 25일 오후 5시",
      },
    ]);
  });
  it("목록 HTML에서 같은 사이트 게시글 링크만", () => {
    const html = `<nav><a href="/menu">메뉴 바로가기 링크</a></nav>
      <table><tr><td><a href="/bbs/view.do?seq=1201">교내 장학금 신청 설명회 개최 안내</a></td></tr>
      <tr><td><a href="https://other.com/view?seq=1">외부 사이트 공지 링크입니다</a></td></tr>
      <tr><td><a href="/bbs/view.do?seq=1201">교내 장학금 신청 설명회 개최 안내</a></td></tr></table>`;
    expect(parseListHtml(html, "https://www.example.ac.kr/notice")).toEqual([
      { title: "교내 장학금 신청 설명회 개최 안내", url: "https://www.example.ac.kr/bbs/view.do?seq=1201" },
    ]);
  });
  it("행사성 글 고르기", () => {
    expect(looksLikeEvent("AI 커리어 특강 안내")).toBe(true);
    expect(looksLikeEvent("2학기 수강 정정 안내")).toBe(false);
    expect(looksLikeEvent("전산 시스템 점검 안내")).toBe(false);
  });
});
