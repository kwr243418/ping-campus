// Web Push 발송 (서버 전용). VAPID 키가 없으면 보내지 않고 false를 돌려줍니다.
import "server-only";
import * as webpush from "web-push";
import type { PushSubscription } from "web-push";
import { getStore } from "./store";

let configured: boolean | null = null;

export function isPushConfigured(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  configured = !!(pub && priv);
  if (configured) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@example.com", pub!, priv!);
  }
  return configured;
}

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag?: string;
}

/** 한 기기에 보냅니다. 구독이 만료(404/410)되면 구독 정보를 지웁니다. */
export async function sendPush(
  deviceId: string,
  subscription: PushSubscription | null,
  payload: PushPayload,
): Promise<boolean> {
  if (!subscription || !isPushConfigured()) return false;
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload), { TTL: 60 * 60, urgency: "high" });
    return true;
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) await getStore().setPushSubscription(deviceId, null);
    else console.error("[push] 발송 실패", status ?? (err as Error).message);
    return false;
  }
}
