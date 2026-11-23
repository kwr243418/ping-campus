import { NextResponse } from "next/server";
import { parseBody, serverError } from "@/lib/server/http";
import { getStore } from "@/lib/server/store";
import { SubscribeRequestSchema } from "@/lib/server/validate";

// Web Push 구독 저장 (subscription: null이면 해제)
export async function POST(request: Request) {
  const parsed = await parseBody(request, SubscribeRequestSchema);
  if ("error" in parsed) return parsed.error;
  try {
    const store = getStore();
    if (!(await store.getDevice(parsed.data.deviceId))) {
      return NextResponse.json({ error: "기기 등록이 먼저 필요해요." }, { status: 404 });
    }
    await store.setPushSubscription(parsed.data.deviceId, parsed.data.subscription);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError("push/subscribe", err);
  }
}
