// 학교 홈페이지 공지 수집 (FR-9): robots.txt 확인, RSS·목록 HTML에서 글 목록 뽑기, 행사성 글 고르기
export interface NoticeItem {
  title: string;
  url: string;
  publishedAt?: string;
  description?: string;
}

/** robots.txt에서 User-agent: * (또는 우리 봇) 그룹의 Disallow 규칙으로 경로 허용 여부 판단 */
export function isAllowedByRobots(robotsTxt: string, path: string, botName = "PingCampusBot"): boolean {
  const groups: { agents: string[]; disallow: string[]; allow: string[] }[] = [];
  let current: (typeof groups)[number] | null = null;
  let lastWasAgent = false;
  for (const raw of robotsTxt.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const field = m[1].toLowerCase();
    const value = m[2].trim();
    if (field === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], disallow: [], allow: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if (!current) continue;
      if (field === "disallow" && value) current.disallow.push(value);
      if (field === "allow" && value) current.allow.push(value);
    }
  }
  const bot = botName.toLowerCase();
  const group = groups.find((g) => g.agents.some((a) => a !== "*" && bot.includes(a))) ?? groups.find((g) => g.agents.includes("*"));
  if (!group) return true;
  const match = (rule: string) => {
    const re = new RegExp("^" + rule.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$"));
    return re.test(path);
  };
  const longest = (rules: string[]) => Math.max(-1, ...rules.filter(match).map((r) => r.length));
  return longest(group.allow) >= longest(group.disallow);
}

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .trim();

const stripTags = (s: string) => decode(s).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

/** RSS 2.0 / Atom */
export function parseFeed(xml: string, baseUrl: string): NoticeItem[] {
  const items: NoticeItem[] = [];
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ?? [];
  for (const block of blocks) {
    const tag = (name: string) => block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"))?.[1];
    const title = tag("title");
    const link = tag("link") ?? block.match(/<link[^>]*href="([^"]+)"/i)?.[1];
    if (!title || !link) continue;
    items.push({
      title: stripTags(title),
      url: new URL(decode(link), baseUrl).toString(),
      publishedAt: tag("pubDate") ?? tag("updated") ?? tag("published"),
      description: tag("description") ? stripTags(tag("description")!).slice(0, 2000) : undefined,
    });
  }
  return items;
}

/** 공지 목록 HTML: 같은 사이트 안의 글 링크(제목이 있는 a 태그)를 모읍니다 */
export function parseListHtml(html: string, baseUrl: string): NoticeItem[] {
  const base = new URL(baseUrl);
  const seen = new Set<string>();
  const items: NoticeItem[] = [];
  const body = html.replace(/<(script|style|nav|header|footer)[\s\S]*?<\/\1>/gi, " ");
  for (const m of body.matchAll(/<a\s[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const title = stripTags(m[2]);
    if (title.length < 6 || title.length > 120) continue;
    let url: URL;
    try {
      url = new URL(decode(m[1]), base);
    } catch {
      continue;
    }
    if (url.host !== base.host || !/^https?:$/.test(url.protocol)) continue;
    // 게시글처럼 보이는 링크만 (글 번호·view·article 등)
    if (!/(view|read|article|detail|board|bbs|notice|seq|idx|no=|\d{3,})/i.test(url.pathname + url.search)) continue;
    const key = url.toString();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ title, url: key });
  }
  return items;
}

const EVENT_WORDS = /특강|강연|세미나|설명회|박람회|채용|공모전|대회|해커톤|워크숍|워크샵|행사|축제|모집|프로그램|캠프|멘토링|간담회|교육|콘서트|공연/;
const NON_EVENT_WORDS = /휴강|성적|등록금|수강\s*정정|졸업\s*사정|장애|점검|입찰|결과\s*발표|합격자|채용\s*결과/;

/** AI 키가 없을 때 쓰는 행사성 글 분류 (키워드) */
export function looksLikeEvent(title: string): boolean {
  return EVENT_WORDS.test(title) && !NON_EVENT_WORDS.test(title);
}
