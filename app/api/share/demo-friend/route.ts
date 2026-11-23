import { NextResponse } from "next/server";
import { z } from "zod";
import { minutesToTime, toDateString, toTimeString, timeToMinutes } from "@/lib/dates";
import { demoToolsEnabled } from "@/lib/server/auth";
import { parseBody, serverError } from "@/lib/server/http";
import { ShareError, registerShare, resolveNow } from "@/lib/server/shareService";
import { getStore } from "@/lib/server/store";
import { DeviceIdSchema } from "@/lib/server/validate";

const SAMPLES = [
  { title: "현직 개발자 초청 특강", location: "공학관 105", category: "lecture" as const },
  { title: "학과 진로 멘토링 (선배와의 대화)", location: "학생회관 3층 세미나실", category: "dept" as const },
  { title: "IT 기업 현장 채용 상담회", location: "본관 대회의실", category: "career" as const },
  { title: "캡스톤 중간 발표회 공개 세션", location: "공학관 501", category: "dept" as const },
];

// 테스트 모드 '가상 학과 친구가 등록하기': 같은 학과·학년의 가상 기기가 촉박한 당일 행사를 공유합니다 (C 수신 확인용)
export async function POST(request: Request) {
  if (!demoToolsEnabled()) return NextResponse.json({ error: "데모 도구가 꺼져 있어요." }, { status: 403 });
  const parsed = await parseBody(request, z.object({ deviceId: DeviceIdSchema, now: z.string().optional() }));
  if ("error" in parsed) return parsed.error;
  try {
    const store = getStore();
    const me = await store.getDevice(parsed.data.deviceId);
    if (!me?.departmentCode || !me.grade) {
      return NextResponse.json({ error: "학과·학년을 먼저 골라 주세요." }, { status: 400 });
    }
    const now = resolveNow(parsed.data.now);
    // 지금부터 약 2시간 뒤(10분 단위) 시작하는 오늘 행사
    const start = Math.ceil((timeToMinutes(toTimeString(now)) + 120) / 10) * 10;
    if (start > 23 * 60 + 50) {
      return NextResponse.json({ error: "오늘 남은 시간이 부족해요. 테스트 모드에서 현재 시각을 낮 시간으로 바꿔 보세요." }, { status: 400 });
    }
    const friendId = crypto.randomUUID();
    await store.upsertDevice({ id: friendId, departmentCode: me.departmentCode, grade: me.grade, urgentEnabled: true });
    const sample = SAMPLES[Math.floor(now.getTime() / 1000) % SAMPLES.length];
    const result = await registerShare({
      device: (await store.getDevice(friendId))!,
      fields: {
        title: sample.title,
        date: toDateString(now),
        startTime: minutesToTime(start),
        endTime: minutesToTime(Math.min(start + 90, 23 * 60 + 55)),
        location: sample.location,
        category: sample.category,
        applyUrl: null,
      },
      scope: "grade",
      grades: [me.grade],
      now,
    });
    return NextResponse.json({ ...result, title: sample.title, startTime: minutesToTime(start) });
  } catch (err) {
    if (err instanceof ShareError) return NextResponse.json({ error: err.message }, { status: err.status });
    return serverError("share/demo-friend", err);
  }
}
