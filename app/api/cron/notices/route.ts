import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/server/auth";
import { serverError } from "@/lib/server/http";
import { collectSchoolNotices } from "@/lib/server/notices";

export const maxDuration = 60;

// 학교 홈페이지 공지 수집 (FR-9). 매일 07:00, 13:00 스케줄러가 호출합니다.
async function run(request: Request) {
  if (!isCronAuthorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, ...(await collectSchoolNotices()) });
  } catch (err) {
    return serverError("cron/notices", err);
  }
}

export const GET = run;
export const POST = run;
