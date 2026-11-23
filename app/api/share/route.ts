import { NextResponse } from "next/server";
import { z } from "zod";
import { toDateString } from "@/lib/dates";
import { canSeeInFeed, toFeedItem, type SharedRecord } from "@/lib/share";
import { parseBody, serverError } from "@/lib/server/http";
import { ShareError, registerShare, resolveNow } from "@/lib/server/shareService";
import { getStore } from "@/lib/server/store";
import { DeviceIdSchema, ShareRequestSchema } from "@/lib/server/validate";

// 우리 학과 피드 조회. 등록자·신고자 기기 ID는 내려보내지 않고 인원수만 보냅니다.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const deviceId = DeviceIdSchema.safeParse(params.get("deviceId"));
  if (!deviceId.success) return NextResponse.json({ error: "기기 ID가 필요해요." }, { status: 400 });
  try {
    const store = getStore();
    const device = await store.getDevice(deviceId.data);
    if (!device) return NextResponse.json({ items: [], department: null });
    const today = toDateString(resolveNow(params.get("now")));
    const codes = device.departmentCode ? [device.departmentCode, "*"] : ["*"];
    const rows = await store.listSharedEvents(codes, today);
    const items = rows
      .filter((r) => canSeeInFeed(device, r as SharedRecord))
      .map((r) => toFeedItem(r as SharedRecord & { origin: typeof r.origin }, device.id));
    return NextResponse.json({ items, department: device.departmentCode, grade: device.grade });
  } catch (err) {
    return serverError("share:GET", err);
  }
}

// 공유 등록: 합치기·촉박함 판단·C 즉시 발송
export async function POST(request: Request) {
  const parsed = await parseBody(request, ShareRequestSchema.extend({ now: z.string().optional() }));
  if ("error" in parsed) return parsed.error;
  const { deviceId, scope, grades, event, now } = parsed.data;
  try {
    const device = await getStore().getDevice(deviceId);
    if (!device) return NextResponse.json({ error: "기기 등록이 먼저 필요해요." }, { status: 404 });
    return NextResponse.json(await registerShare({ device, fields: event, scope, grades, now: resolveNow(now) }));
  } catch (err) {
    if (err instanceof ShareError) return NextResponse.json({ error: err.message }, { status: err.status });
    return serverError("share:POST", err);
  }
}
