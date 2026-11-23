import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { recognizeTimetable } from "@/lib/extract/timetable";
import { parseBody } from "@/lib/server/http";

export const runtime = "nodejs";

const Body = z.object({
  imageBase64: z.string().min(10).max(8_000_000),
  mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]),
});

// 시간표 캡처 → 수업 블록 (P1). 이미지는 저장하지 않고, 결과는 사용자 확인 화면을 거쳐 기기에만 저장합니다.
export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "지금은 AI 키가 없어 캡처를 읽을 수 없어요. 격자에서 직접 입력해 주세요." },
      { status: 400 },
    );
  }
  const parsed = await parseBody(request, Body);
  if ("error" in parsed) return parsed.error;
  try {
    const classes = await recognizeTimetable({ data: parsed.data.imageBase64, mediaType: parsed.data.mediaType });
    return NextResponse.json({ classes });
  } catch (err) {
    if (err instanceof Anthropic.APIError) console.error("[extract-timetable] API error", err.status);
    else console.error("[extract-timetable]", (err as Error).message);
    return NextResponse.json({ error: "시간표를 읽지 못했어요. 다른 캡처로 해 보거나 직접 입력해 주세요." }, { status: 502 });
  }
}
