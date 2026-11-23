import { NextResponse } from "next/server";
import { ExtractError, runExtraction } from "@/lib/extract/run";
import { ExtractRequestSchema } from "@/lib/extract/schema";

export const runtime = "nodejs";

// 공지 텍스트·이미지·링크 → 행사 JSON
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않아요." }, { status: 400 });
  }
  const parsed = ExtractRequestSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "입력을 확인해 주세요.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  try {
    return NextResponse.json(await runExtraction(parsed.data));
  } catch (err) {
    if (err instanceof ExtractError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[extract] unexpected", err);
    return NextResponse.json({ error: "정리하지 못했어요. 잠시 후 다시 시도해 주세요." }, { status: 500 });
  }
}
