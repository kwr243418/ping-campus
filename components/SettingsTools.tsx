"use client";

import { useEffect, useState } from "react";
import { BellRing, Send, UserPlus } from "lucide-react";
import { secondaryButtonClass } from "./ui";
import {
  getDeviceId,
  hasPushSubscription,
  postJSON,
  pushSupported,
  registerDevice,
  showLocalNotification,
  subscribePush,
  unsubscribePush,
  type DeviceStatus,
} from "@/lib/client/device";
import { addToInbox } from "@/lib/client/inbox";
import { loadPlanInput } from "@/lib/client/planInput";
import { demoFriendShare } from "@/lib/client/share";
import { getNow } from "@/lib/dates";
import { computeMessages } from "@/lib/notifyPlan";

type PushState = "loading" | "unsupported" | "denied" | "off" | "on";

/** Web Push 구독 상태와 켜기·끄기 */
export function PushSection() {
  const [push, setPush] = useState<PushState>("loading");
  const [server, setServer] = useState<DeviceStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function refresh() {
    if (!pushSupported()) return setPush("unsupported");
    if (Notification.permission === "denied") return setPush("denied");
    setPush((await hasPushSubscription()) ? "on" : "off");
  }

  useEffect(() => {
    refresh();
    registerDevice().then(setServer).catch(() => setServer(null));
  }, []);

  async function turnOn() {
    setBusy(true);
    setNote(null);
    const r = await subscribePush();
    setBusy(false);
    if (r === "no-server-key") setNote("서버에 푸시 키(VAPID)가 없어 앱 안 알림센터로만 받아요.");
    if (r === "failed") setNote("구독하지 못했어요. 잠시 후 다시 시도해 주세요.");
    refresh();
  }

  return (
    <div className="space-y-2 py-3">
      <p className="text-sm text-slate-600">
        {push === "on" && "앱을 닫아도 이 기기로 알림이 와요."}
        {push === "off" && "켜면 앱을 닫아도 알림을 받아요. 꺼져 있으면 앱을 열었을 때 알림센터에 쌓여요."}
        {push === "denied" && "브라우저에서 알림이 차단되어 있어요. 브라우저 설정에서 허용해 주세요."}
        {push === "unsupported" &&
          "이 브라우저는 푸시를 지원하지 않아요. iPhone은 Safari에서 '홈 화면에 추가'한 뒤 앱으로 열면 켤 수 있어요."}
        {push === "loading" && "확인하는 중이에요…"}
      </p>
      {push === "off" && (
        <button type="button" disabled={busy} onClick={turnOn} className={`${secondaryButtonClass} w-full`}>
          <BellRing aria-hidden className="size-4" />
          {busy ? "켜는 중…" : "푸시 알림 켜기"}
        </button>
      )}
      {push === "on" && (
        <button
          type="button"
          onClick={async () => {
            await unsubscribePush();
            refresh();
          }}
          className="min-h-11 text-sm font-semibold text-slate-600 underline underline-offset-2"
        >
          푸시 알림 끄기
        </button>
      )}
      {note && <p className="text-sm font-medium text-amber-900">{note}</p>}
      {server && (
        <p className="text-xs text-slate-500">
          서버 저장소: {server.storage === "supabase" ? "Supabase" : "서버 메모리(데모)"} · 푸시 키 {server.pushConfigured ? "있음" : "없음"}
        </p>
      )}
    </div>
  );
}

/** 테스트 모드: 지금 알림 보내기, 가상 학과 친구가 등록하기 */
export function TestTools({ hasDept }: { hasDept: boolean }) {
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState<"send" | "friend" | null>(null);

  async function sendNow() {
    setBusy("send");
    setResult(null);
    try {
      const r = await postJSON<{ pushed: boolean; reason: string | null; payload: { title: string; body: string; url: string } }>(
        "/api/notify/test",
        { deviceId: getDeviceId() },
      );
      if (r.pushed) {
        setResult("푸시를 보냈어요. 잠시 뒤 기기 알림을 확인하세요.");
      } else {
        // 푸시를 못 보내면 다음 알림을 앱 안에서 바로 보여 줍니다 (Supabase·푸시 없이 시연)
        const next = computeMessages(loadPlanInput(getNow()))[0];
        const msg = next
          ? { ...next, key: `test:${next.key}:${Date.now()}` }
          : { key: `test:${Date.now()}`, kind: "beforeEvent" as const, title: "[핑캠퍼스] 테스트 알림", body: "알림이 잘 도착했어요.", url: "/" };
        addToInbox(msg, getNow());
        await showLocalNotification(msg.title, msg.body, msg.url, msg.key);
        setResult(
          `${r.reason === "no-vapid" ? "푸시 키가 없어" : "이 기기는 푸시를 켜지 않아"} 앱 안 알림센터로 보냈어요: ${msg.body}`,
        );
      }
    } catch (e) {
      setResult((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function friend() {
    setBusy("friend");
    setResult(null);
    try {
      const r = await demoFriendShare();
      setResult(
        r.urgentSent
          ? `가상 친구가 오늘 ${r.startTime} '${r.title}'을(를) 공유했어요. 곧 ⚡ 알림이 와요.`
          : r.urgentLimited
            ? `가상 친구가 공유했지만 오늘 학과 긴급 알림이 3건을 넘어 피드에만 올렸어요.`
            : r.merged
              ? `같은 행사가 있어 합쳤어요 (${r.registrantCount}명이 등록).`
              : `공유했지만 촉박한 행사가 아니라 피드에만 올렸어요.`,
      );
    } catch (e) {
      setResult((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2 py-3">
      <div className="grid grid-cols-1 gap-2">
        <button type="button" disabled={!!busy} onClick={sendNow} className={`${secondaryButtonClass} w-full`}>
          <Send aria-hidden className="size-4" />
          {busy === "send" ? "보내는 중…" : "지금 알림 보내기"}
        </button>
        <button type="button" disabled={!!busy || !hasDept} onClick={friend} className={`${secondaryButtonClass} w-full disabled:opacity-60`}>
          <UserPlus aria-hidden className="size-4" />
          {busy === "friend" ? "등록하는 중…" : "가상 학과 친구가 등록하기"}
        </button>
      </div>
      {!hasDept && <p className="text-xs text-slate-600">가상 친구 기능은 학과·학년을 고른 뒤 쓸 수 있어요.</p>}
      {result && (
        <p role="status" className="rounded-lg bg-violet-50 px-3 py-2 text-sm text-violet-900">
          {result}
        </p>
      )}
    </div>
  );
}
