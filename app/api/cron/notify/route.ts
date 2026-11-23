import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/server/auth";
import { runNotifyCron } from "@/lib/server/cron";
import { serverError } from "@/lib/server/http";

// 도래한 알림 발송 (10분 간격 스케줄러가 호출). Authorization: Bearer ${CRON_SECRET}
async function run(request: Request) {
  if (!isCronAuthorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, ...(await runNotifyCron()) });
  } catch (err) {
    return serverError("cron/notify", err);
  }
}

export const GET = run; // Vercel Cron은 GET으로 호출
export const POST = run;
