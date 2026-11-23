import { NextResponse } from "next/server";
import { z } from "zod";
import { TITLE_PREFIX } from "@/lib/notifyMessages";
import { parseBody, serverError } from "@/lib/server/http";
import { isPushConfigured, sendPush } from "@/lib/server/push";
import { getStore } from "@/lib/server/store";
import { DeviceIdSchema } from "@/lib/server/validate";

// 테스트 모드 '지금 알림 보내기': 이 기기의 다음 예약 알림을 지금 푸시로 보냅니다(예약은 그대로 둠)
export async function POST(request: Request) {
  const parsed = await parseBody(request, z.object({ deviceId: DeviceIdSchema }));
  if ("error" in parsed) return parsed.error;
  try {
    const store = getStore();
    const device = await store.getDevice(parsed.data.deviceId);
    if (!device) return NextResponse.json({ error: "기기 등록이 먼저 필요해요." }, { status: 404 });
    const [next] = await store.listPendingScheduled(device.id);
    const payload = next
      ? { title: next.title, body: next.body, url: next.url, tag: `test-${next.key}` }
      : { title: `${TITLE_PREFIX} 테스트 알림`, body: "알림이 잘 도착했어요.", url: "/", tag: "test" };
    const pushed = await sendPush(device.id, device.pushSubscription, payload);
    return NextResponse.json({
      pushed,
      reason: pushed ? null : !isPushConfigured() ? "no-vapid" : !device.pushSubscription ? "no-subscription" : "send-failed",
      payload,
    });
  } catch (err) {
    return serverError("notify/test", err);
  }
}
