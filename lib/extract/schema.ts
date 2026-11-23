// AI 추출 결과 스키마(zod). AI 응답은 반드시 이 스키마로 검증합니다.
import { z } from "zod";
import { isValidDate, isValidTime } from "../dates";

export const CATEGORY_VALUES = [
  "lecture",
  "career",
  "scholarship",
  "contest",
  "dept",
  "club",
  "etc",
] as const;

export const SOURCE_VALUES = ["kakao", "homepage", "everytime", "offline", "link", "other"] as const;

const Confidence = z.enum(["high", "medium", "low"]);

export const ExtractedEventSchema = z.object({
  title: z.string().describe("행사 제목. 공지에 없으면 내용을 요약한 짧은 제목"),
  date: z.string().nullable().describe("YYYY-MM-DD. 공지에 없으면 null"),
  startTime: z.string().nullable().describe("24시간제 HH:mm. 공지에 없으면 null"),
  endTime: z.string().nullable().describe("24시간제 HH:mm. 공지에 없으면 null"),
  location: z.string().nullable().describe("장소. 공지에 없으면 null"),
  organizer: z.string().nullable(),
  category: z.enum(CATEGORY_VALUES),
  target: z.string().nullable().describe("참여 대상 (예: 3학년, 전 학년)"),
  applyUrl: z.string().nullable(),
  applyDeadline: z.string().nullable().describe("신청 마감 YYYY-MM-DD 또는 YYYY-MM-DD HH:mm"),
  summary: z.string().nullable().describe("한두 문장 요약"),
  confidence: z.object({
    title: Confidence,
    date: Confidence,
    startTime: Confidence,
    location: Confidence,
  }),
});

export const ExtractionSchema = z.object({
  isEvent: z.boolean().describe("행사·특강·일정 공지인지"),
  events: z.array(ExtractedEventSchema),
});

export type ExtractedEvent = z.infer<typeof ExtractedEventSchema>;
export type Extraction = z.infer<typeof ExtractionSchema>;

/** /api/extract 요청 본문 */
export const ExtractRequestSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("text"),
    text: z.string().trim().min(5, "공지 내용을 조금 더 붙여넣어 주세요.").max(20000),
    source: z.enum(SOURCE_VALUES),
    postedAt: z.string().optional(),
  }),
  z.object({
    mode: z.literal("image"),
    imageBase64: z.string().min(10).max(8_000_000),
    mediaType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
    source: z.enum(SOURCE_VALUES),
    postedAt: z.string().optional(),
  }),
  z.object({
    mode: z.literal("link"),
    url: z.string().url("올바른 링크를 입력해 주세요."),
    source: z.enum(SOURCE_VALUES),
    postedAt: z.string().optional(),
  }),
]);
export type ExtractRequest = z.infer<typeof ExtractRequestSchema>;

export interface ExtractResponse {
  events: ExtractedEvent[];
  engine: "ai" | "fallback";
  /** 마스킹한 원문 (기기에만 저장) */
  maskedText: string;
  /** 사용자에게 보여 줄 안내 */
  notice?: string;
}

const blankToNull = (v: string | null | undefined) => {
  const t = v?.trim();
  return t ? t : null;
};

/** 형식이 맞지 않는 값은 지어내지 않고 비웁니다 */
export function normalizeExtracted(e: ExtractedEvent): ExtractedEvent {
  const time = (v: string | null) => {
    const t = blankToNull(v)?.replace(/^(\d):/, "0$1:") ?? null;
    return t && isValidTime(t) ? t : null;
  };
  const date = blankToNull(e.date);
  const url = blankToNull(e.applyUrl);
  return {
    ...e,
    title: e.title.trim() || "제목 없는 행사",
    date: date && isValidDate(date) ? date : null,
    startTime: time(e.startTime),
    endTime: time(e.endTime),
    location: blankToNull(e.location),
    organizer: blankToNull(e.organizer),
    target: blankToNull(e.target),
    applyUrl: url && /^https?:\/\//.test(url) ? url : null,
    applyDeadline: blankToNull(e.applyDeadline),
    summary: blankToNull(e.summary),
  };
}
