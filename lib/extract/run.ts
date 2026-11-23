// 서버 전용: 공지 → 행사 추출. API 키가 없거나 AI 응답 검증에 실패하면 대체 파서로 처리합니다.
import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { WEEKDAY_LABEL, getNow, toDateString, toTimeString, weekdayOf } from "../dates";
import { parseNoticeFallback } from "./fallbackParser";
import { maskPersonalInfo } from "./mask";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompt";
import {
  ExtractionSchema,
  normalizeExtracted,
  type ExtractRequest,
  type ExtractResponse,
} from "./schema";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
const MAX_PAGE_CHARS = 30_000;

export class ExtractError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

function baseOf(postedAt?: string) {
  const parsed = postedAt ? new Date(postedAt) : null;
  const at = parsed && !Number.isNaN(parsed.getTime()) ? parsed : getNow();
  const date = toDateString(at);
  return {
    baseDate: date,
    baseWeekday: WEEKDAY_LABEL[weekdayOf(date)],
    baseTime: toTimeString(at),
    postedAtKnown: !!parsed && !Number.isNaN(parsed.getTime()),
  };
}

type ImageInput = { data: string; mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" };

async function extractWithClaude(
  text: string | null,
  image: ImageInput | null,
  base: ReturnType<typeof baseOf>,
  source: string,
) {
  const client = new Anthropic();
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (image) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: image.mediaType, data: image.data },
    });
  }
  content.push({ type: "text", text: buildUserPrompt({ ...base, text: text ?? undefined, source }) });

  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    // 거절 시 서버 측 대체 모델로 다시 시도
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    // 정형 추출 작업이라 낮은 effort로 응답 시간(목표 10초 이내)을 줄입니다
    output_config: { effort: "low", format: betaZodOutputFormat(ExtractionSchema) },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content }],
  });

  if (response.stop_reason === "refusal") throw new Error("model refusal");
  // CLAUDE.md: AI 응답은 반드시 zod로 다시 검증
  const checked = ExtractionSchema.safeParse(response.parsed_output);
  if (!checked.success) throw new Error("schema validation failed");
  return checked.data;
}

/** 사설·루프백·링크 로컬 주소 (IPv4, IPv6, IPv4-mapped IPv6) */
function isPrivateAddress(ip: string): boolean {
  const a = ip.toLowerCase().replace(/^\[|\]$/g, "");
  const mapped = a.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateAddress(mapped[1]);
  if (isIP(a) === 4) {
    return /^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|22[4-9]\.|2[3-5]\d\.)/.test(a);
  }
  if (isIP(a) === 6) {
    return a === "::" || a === "::1" || /^f[cd]/.test(a) || /^fe[89ab]/.test(a) || /^ff/.test(a) || a.startsWith("::ffff:");
  }
  return false;
}

/** 링크가 공개 인터넷 주소인지 확인합니다 (이름을 실제 IP로 풀어서 검사) */
async function assertPublicUrl(url: URL): Promise<void> {
  const blocked = new ExtractError("이 링크는 불러올 수 없어요. 공지 내용을 복사해 붙여넣어 주세요.");
  const h = url.hostname.toLowerCase();
  if (!/^https?:$/.test(url.protocol) || url.username || url.password) throw blocked;
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) throw blocked;
  if (isIP(h.replace(/^\[|\]$/g, ""))) {
    if (isPrivateAddress(h)) throw blocked;
    return;
  }
  let addresses: { address: string }[];
  try {
    addresses = await lookup(h, { all: true, verbatim: true });
  } catch {
    throw new ExtractError("링크를 열지 못했어요. 공지 내용을 복사해 붙여넣어 주세요.");
  }
  if (addresses.length === 0 || addresses.some((r) => isPrivateAddress(r.address))) throw blocked;
}

const MAX_REDIRECTS = 3;

async function fetchPageText(url: string): Promise<string> {
  let current = new URL(url);
  let res: Response | null = null;
  // 리다이렉트를 직접 따라가며 주소마다 다시 검사합니다 (공개 주소 → 내부 주소 우회 방지)
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicUrl(current);
    try {
      res = await fetch(current, {
        headers: { "User-Agent": "PingCampusBot/0.1 (+student project)" },
        signal: AbortSignal.timeout(8000),
        redirect: "manual",
      });
    } catch {
      throw new ExtractError("링크를 열지 못했어요. 공지 내용을 복사해 붙여넣어 주세요.");
    }
    const location = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
    if (!location) break;
    current = new URL(location, current);
    res = null;
  }
  if (!res) throw new ExtractError("링크가 너무 여러 번 다른 곳으로 넘어가요. 공지 내용을 붙여넣어 주세요.");
  if (!res.ok) {
    throw new ExtractError(
      res.status === 401 || res.status === 403
        ? "로그인이 필요한 페이지예요. 공지 내용을 복사해 붙여넣어 주세요."
        : "링크를 열지 못했어요. 공지 내용을 복사해 붙여넣어 주세요.",
    );
  }
  const html = await res.text();
  const text = html
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|h\d|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
  if (text.length < 10) throw new ExtractError("페이지에서 글을 찾지 못했어요. 공지 내용을 붙여넣어 주세요.");
  return text.slice(0, MAX_PAGE_CHARS);
}

export async function runExtraction(req: ExtractRequest): Promise<ExtractResponse> {
  const base = baseOf(req.postedAt);
  const hasKey = !!process.env.ANTHROPIC_API_KEY;

  if (req.mode === "image") {
    if (!hasKey) {
      throw new ExtractError(
        "지금은 AI 키가 없어 이미지를 읽을 수 없어요. 공지 글을 텍스트로 붙여넣어 주세요.",
      );
    }
    // 이미지는 메모리에서만 쓰고 저장하지 않습니다
    try {
      const result = await extractWithClaude(null, { data: req.imageBase64, mediaType: req.mediaType }, base, req.source);
      return {
        events: result.events.map(normalizeExtracted),
        engine: "ai",
        maskedText: "",
        notice: result.isEvent ? undefined : "행사 공지가 아닌 것 같아요. 내용을 확인해 주세요.",
      };
    } catch (err) {
      if (err instanceof Anthropic.APIError) console.error("[extract] API error", err.status);
      throw new ExtractError("이미지를 읽지 못했어요. 공지 글을 텍스트로 붙여넣어 주세요.", 502);
    }
  }

  const raw = req.mode === "link" ? await fetchPageText(req.url) : req.text;
  const masked = maskPersonalInfo(raw);

  if (hasKey) {
    try {
      const result = await extractWithClaude(masked, null, base, req.source);
      return {
        events: result.events.map(normalizeExtracted),
        engine: "ai",
        maskedText: masked,
        notice: result.isEvent ? undefined : "행사 공지가 아닌 것 같아요. 내용을 확인해 주세요.",
      };
    } catch (err) {
      if (err instanceof Anthropic.RateLimitError) console.error("[extract] rate limited");
      else if (err instanceof Anthropic.APIError) console.error("[extract] API error", err.status);
      else console.error("[extract] AI 추출 실패:", (err as Error).message);
      return {
        events: [normalizeExtracted(parseNoticeFallback(masked, base.baseDate))],
        engine: "fallback",
        maskedText: masked,
        notice: "AI 정리에 실패해 간단한 규칙으로 정리했어요. 내용을 꼭 확인하고 고쳐 주세요.",
      };
    }
  }

  return {
    events: [normalizeExtracted(parseNoticeFallback(masked, base.baseDate))],
    engine: "fallback",
    maskedText: masked,
    notice: "AI 키 없이 간단한 규칙으로 정리했어요(데모 모드). 내용을 꼭 확인하고 고쳐 주세요.",
  };
}
