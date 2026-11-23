import { NextResponse } from "next/server";
import { findDepartment } from "@/config/departments";
import { parseBody, serverError } from "@/lib/server/http";
import { isPushConfigured } from "@/lib/server/push";
import { getStore } from "@/lib/server/store";
import { DeviceRequestSchema } from "@/lib/server/validate";

// 익명 기기 등록, 학과·학년 변경. 이름·학번·이메일은 받지 않습니다.
export async function POST(request: Request) {
  const parsed = await parseBody(request, DeviceRequestSchema);
  if ("error" in parsed) return parsed.error;
  const { deviceId, departmentCode, grade, urgentEnabled } = parsed.data;
  if (departmentCode && !findDepartment(departmentCode)) {
    return NextResponse.json({ error: "목록에 없는 학과예요." }, { status: 400 });
  }
  try {
    const store = getStore();
    await store.upsertDevice({ id: deviceId, departmentCode, grade, urgentEnabled });
    const device = await store.getDevice(deviceId);
    return NextResponse.json({
      ok: true,
      storage: store.kind,
      pushConfigured: isPushConfigured(),
      subscribed: !!device?.pushSubscription,
    });
  } catch (err) {
    return serverError("device", err);
  }
}
