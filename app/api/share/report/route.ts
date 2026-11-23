import { NextResponse } from "next/server";
import { applyReport, canReport, type SharedRecord } from "@/lib/share";
import { parseBody, serverError } from "@/lib/server/http";
import { getStore } from "@/lib/server/store";
import { ReportRequestSchema } from "@/lib/server/validate";

// "정보가 틀려요" 신고. 서로 다른 기기 2대 이상이면 숨기고 아직 보내지 않은 알림을 취소합니다.
export async function POST(request: Request) {
  const parsed = await parseBody(request, ReportRequestSchema);
  if ("error" in parsed) return parsed.error;
  try {
    const store = getStore();
    const row = await store.getSharedEvent(parsed.data.sharedEventId);
    if (!row) return NextResponse.json({ error: "행사를 찾지 못했어요." }, { status: 404 });
    // 등록된 기기가, 자기 피드에 보이는 행사만 신고할 수 있습니다 (등록자 본인 제외)
    const device = await store.getDevice(parsed.data.deviceId);
    if (!canReport(device, row as SharedRecord)) {
      return NextResponse.json({ error: "이 행사는 신고할 수 없어요." }, { status: 403 });
    }
    const result = applyReport(row as SharedRecord, parsed.data.deviceId);
    await store.updateSharedEvent(row.id, { reportDeviceIds: result.reportDeviceIds, hidden: result.hidden });
    if (result.becameHidden) await store.cancelScheduledForSharedEvent(row.id, row.registrantDeviceIds);
    return NextResponse.json({ ok: true, hidden: result.hidden });
  } catch (err) {
    return serverError("share/report", err);
  }
}
