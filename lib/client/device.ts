// 익명 기기 ID 발급·등록, Web Push 구독 (브라우저 전용)
import { STORAGE_KEYS, readJSON, writeJSON } from "../storage";
import { DEFAULT_NOTIFY_SETTINGS, type NotifySettings } from "../types";
import type { Profile } from "../useAppData";

export interface DeviceStatus {
  storage: "supabase" | "memory";
  pushConfigured: boolean;
  subscribed: boolean;
}

export function getDeviceId(): string {
  let id = readJSON<string | null>(STORAGE_KEYS.deviceId, null);
  if (!id) {
    id = crypto.randomUUID();
    writeJSON(STORAGE_KEYS.deviceId, id);
  }
  return id;
}

export async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `요청 실패 (${res.status})`);
  return json as T;
}

export async function registerDevice(): Promise<DeviceStatus> {
  const profile = readJSON<Profile>(STORAGE_KEYS.profile, { departmentCode: null, grade: null });
  const settings = readJSON<NotifySettings>(STORAGE_KEYS.notifySettings, DEFAULT_NOTIFY_SETTINGS);
  return postJSON<DeviceStatus>("/api/device", {
    deviceId: getDeviceId(),
    departmentCode: profile.departmentCode,
    grade: profile.grade,
    urgentEnabled: settings.deptUrgent?.enabled ?? true,
  });
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export type SubscribeResult = "subscribed" | "denied" | "unsupported" | "no-server-key" | "failed";

export async function subscribePush(): Promise<SubscribeResult> {
  if (!pushSupported()) return "unsupported";
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) return "no-server-key";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) }));
    await registerDevice();
    await postJSON("/api/push/subscribe", { deviceId: getDeviceId(), subscription: sub.toJSON() });
    return "subscribed";
  } catch (err) {
    console.error("[push] 구독 실패", err);
    return "failed";
  }
}

export async function unsubscribePush(): Promise<void> {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  await sub?.unsubscribe();
  await postJSON("/api/push/subscribe", { deviceId: getDeviceId(), subscription: null }).catch(() => {});
}

export async function hasPushSubscription(): Promise<boolean> {
  if (!pushSupported()) return false;
  const reg = await navigator.serviceWorker.getRegistration();
  return !!(await reg?.pushManager.getSubscription());
}

/** 앱이 열려 있을 때 띄우는 기기 알림 (권한이 있을 때만) */
export async function showLocalNotification(title: string, body: string, url: string, tag: string) {
  if (!pushSupported() || Notification.permission !== "granted") return;
  const reg = await navigator.serviceWorker.getRegistration();
  await reg?.showNotification(title, { body, tag, data: { url }, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png" });
}
