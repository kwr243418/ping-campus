import { NextResponse } from "next/server";
import { parseBody, serverError } from "@/lib/server/http";
import { getStore } from "@/lib/server/store";
import { ScheduleRequestSchema } from "@/lib/server/validate";

// 알림 A·B 예약 등록·갱신·취소. 계산은 기기(lib/schedule.ts)에서 하고,
// 서버에는 발송에 필요한 최소 정보(제목·시각·장소 문구)만 받습니다. 시간표는 받지 않습니다.
export async function POST(request: Request) {
  const parsed = await parseBody(request, ScheduleRequestSchema);
  if ("error" in parsed) return parsed.error;
  const { deviceId, notifications } = parsed.data;
  try {
    const store = getStore();
    if (!(await store.getDevice(deviceId))) {
      return NextResponse.json({ error: "기기 등록이 먼저 필요해요." }, { status: 404 });
    }
    const now = Date.now();
    // 행사가 이미 시작한 알림은 받지 않습니다
    await store.replaceScheduled(
      deviceId,
      notifications.filter((n) => new Date(n.expiresAt).getTime() > now),
    );
    const pending = await store.listPendingScheduled(deviceId);
    return NextResponse.json({ ok: true, pending: pending.length, next: pending[0]?.notifyAt ?? null });
  } catch (err) {
    return serverError("notify/schedule", err);
  }
}
