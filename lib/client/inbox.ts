// 앱 안 알림센터(S10) 저장
import { STORAGE_KEYS, readJSON, writeJSON } from "../storage";
import type { NotificationMessage } from "../notifyMessages";

export interface InboxItem {
  id: string;
  key: string;
  kind: NotificationMessage["kind"];
  title: string;
  body: string;
  url: string;
  at: string; // 받은 시각 (앱 시계 기준, ISO)
  read: boolean;
}

const MAX_INBOX = 100;
const MAX_KEYS = 500;

export function readInbox(): InboxItem[] {
  return readJSON<InboxItem[]>(STORAGE_KEYS.inbox, []);
}

export function deliveredKeys(): Set<string> {
  return new Set(readJSON<string[]>(STORAGE_KEYS.deliveredKeys, []));
}

/** 알림센터에 넣습니다. 이미 넣은 키면 false */
export function addToInbox(m: Pick<NotificationMessage, "key" | "kind" | "title" | "body" | "url">, at: Date): boolean {
  const keys = deliveredKeys();
  if (keys.has(m.key)) return false;
  writeJSON(STORAGE_KEYS.deliveredKeys, [...keys, m.key].slice(-MAX_KEYS));
  const item: InboxItem = { id: crypto.randomUUID(), ...m, at: at.toISOString(), read: false };
  writeJSON(STORAGE_KEYS.inbox, [item, ...readInbox()].slice(0, MAX_INBOX));
  return true;
}

export function markAllRead() {
  const inbox = readInbox();
  if (inbox.some((i) => !i.read)) writeJSON(STORAGE_KEYS.inbox, inbox.map((i) => ({ ...i, read: true })));
}

export function clearInbox() {
  writeJSON(STORAGE_KEYS.inbox, []);
}
