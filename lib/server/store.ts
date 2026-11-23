// 서버 저장소. Supabase 환경변수가 있으면 Supabase, 없으면 서버 메모리(로컬 데모용)를 씁니다.
// 서버 라우트에서만 import 합니다.
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { PushSubscription as WebPushSubscription } from "web-push";
import type { Category } from "../types";

export interface DeviceRow {
  id: string;
  departmentCode: string | null;
  grade: 1 | 2 | 3 | 4 | null;
  urgentEnabled: boolean;
  pushSubscription: WebPushSubscription | null;
}

export interface SharedEventRow {
  id: string;
  departmentCode: string; // '*' = 학교 홈페이지 공용 피드
  scope: "grade" | "department";
  grades: (1 | 2 | 3 | 4)[];
  title: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  category: Category;
  applyUrl: string | null;
  origin: "student" | "homepage";
  isUrgent: boolean;
  registrantDeviceIds: string[];
  reportDeviceIds: string[];
  hidden: boolean;
  urgentSentAt: string | null;
  createdAt: string;
}

export interface ScheduledRow {
  id: string;
  deviceId: string;
  key: string;
  kind: "beforeEvent" | "atGoHome" | "deptUrgent";
  notifyAt: string;
  /** 행사 시작 시각. 지나면 늦었더라도 보내지 않음 */
  expiresAt: string;
  title: string;
  body: string;
  url: string;
  sharedEventIds: string[];
  sentAt: string | null;
  cancelled: boolean;
}

export type NewScheduled = Omit<ScheduledRow, "id" | "deviceId" | "sentAt" | "cancelled">;

export interface Store {
  readonly kind: "supabase" | "memory";
  getDevice(id: string): Promise<DeviceRow | null>;
  upsertDevice(d: Omit<DeviceRow, "pushSubscription">): Promise<void>;
  setPushSubscription(id: string, sub: WebPushSubscription | null): Promise<void>;
  listDevicesInDepartment(departmentCode: string): Promise<DeviceRow[]>;

  /** 기기의 아직 안 보낸 예약을 새 목록으로 바꿉니다 (재계산) */
  replaceScheduled(deviceId: string, items: NewScheduled[]): Promise<void>;
  /** 보낼 시각이 됐고 아직 행사가 시작하지 않은 예약 */
  listDueScheduled(now: Date): Promise<ScheduledRow[]>;
  listPendingScheduled(deviceId: string): Promise<ScheduledRow[]>;
  markSent(ids: string[], at: Date): Promise<void>;
  /** 숨겨진 공유 행사의 예약 취소 (exceptDeviceIds: 등록자 본인 기기는 남김) */
  cancelScheduledForSharedEvent(sharedEventId: string, exceptDeviceIds?: string[]): Promise<void>;

  listSharedEvents(departmentCodes: string[], fromDate: string): Promise<SharedEventRow[]>;
  getSharedEvent(id: string): Promise<SharedEventRow | null>;
  /** createdAt을 주지 않으면 지금 시각 (테스트 모드에서는 테스트 시각을 넘겨 하루 공유 횟수를 맞춥니다) */
  insertSharedEvent(row: Omit<SharedEventRow, "id" | "createdAt"> & { createdAt?: string }): Promise<SharedEventRow>;
  updateSharedEvent(id: string, patch: Partial<SharedEventRow>): Promise<void>;
}

// ── 메모리 저장소 (개발 서버 프로세스 안에서만 유지) ──

interface MemoryData {
  devices: Map<string, DeviceRow>;
  shared: Map<string, SharedEventRow>;
  scheduled: Map<string, ScheduledRow>;
}

const g = globalThis as unknown as { __pingCampusMemory?: MemoryData };
function memory(): MemoryData {
  g.__pingCampusMemory ??= { devices: new Map(), shared: new Map(), scheduled: new Map() };
  return g.__pingCampusMemory;
}

const memoryStore: Store = {
  kind: "memory",
  async getDevice(id) {
    return memory().devices.get(id) ?? null;
  },
  async upsertDevice(d) {
    const prev = memory().devices.get(d.id);
    memory().devices.set(d.id, { ...d, pushSubscription: prev?.pushSubscription ?? null });
  },
  async setPushSubscription(id, sub) {
    const prev = memory().devices.get(id);
    if (prev) prev.pushSubscription = sub;
  },
  async listDevicesInDepartment(code) {
    return [...memory().devices.values()].filter((d) => d.departmentCode === code);
  },
  async replaceScheduled(deviceId, items) {
    const m = memory().scheduled;
    for (const [id, row] of m) if (row.deviceId === deviceId && !row.sentAt) m.delete(id);
    const sentKeys = new Set([...m.values()].filter((r) => r.deviceId === deviceId).map((r) => r.key));
    for (const item of items) {
      if (sentKeys.has(item.key)) continue; // 이미 보낸 알림은 다시 예약하지 않음
      const id = crypto.randomUUID();
      m.set(id, { ...item, id, deviceId, sentAt: null, cancelled: false });
    }
  },
  async listDueScheduled(now) {
    return [...memory().scheduled.values()].filter(
      (r) => !r.sentAt && !r.cancelled && new Date(r.notifyAt) <= now && new Date(r.expiresAt) > now,
    );
  },
  async listPendingScheduled(deviceId) {
    return [...memory().scheduled.values()]
      .filter((r) => r.deviceId === deviceId && !r.sentAt && !r.cancelled)
      .sort((a, b) => a.notifyAt.localeCompare(b.notifyAt));
  },
  async markSent(ids, at) {
    for (const id of ids) {
      const r = memory().scheduled.get(id);
      if (r) r.sentAt = at.toISOString();
    }
  },
  async cancelScheduledForSharedEvent(sharedEventId, exceptDeviceIds = []) {
    for (const r of memory().scheduled.values()) {
      if (!r.sentAt && r.sharedEventIds.includes(sharedEventId) && !exceptDeviceIds.includes(r.deviceId)) r.cancelled = true;
    }
  },
  async listSharedEvents(codes, fromDate) {
    return [...memory().shared.values()]
      .filter((e) => codes.includes(e.departmentCode) && e.date >= fromDate)
      .sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));
  },
  async getSharedEvent(id) {
    return memory().shared.get(id) ?? null;
  },
  async insertSharedEvent(row) {
    const full: SharedEventRow = { ...row, id: crypto.randomUUID(), createdAt: row.createdAt ?? new Date().toISOString() };
    memory().shared.set(full.id, full);
    return full;
  },
  async updateSharedEvent(id, patch) {
    const prev = memory().shared.get(id);
    if (prev) memory().shared.set(id, { ...prev, ...patch });
  },
};

// ── Supabase 저장소 ──

/* eslint-disable @typescript-eslint/no-explicit-any -- DB 행 ↔ 앱 타입 변환 */
const toDevice = (r: any): DeviceRow => ({
  id: r.id,
  departmentCode: r.department_code,
  grade: r.grade,
  urgentEnabled: r.urgent_enabled,
  pushSubscription: r.push_subscription,
});
const toShared = (r: any): SharedEventRow => ({
  id: r.id,
  departmentCode: r.department_code,
  scope: r.scope,
  grades: r.grades ?? [],
  title: r.title,
  date: r.date,
  startTime: r.start_time,
  endTime: r.end_time,
  location: r.location,
  category: r.category,
  applyUrl: r.apply_url,
  origin: r.origin,
  isUrgent: r.is_urgent,
  registrantDeviceIds: r.registrant_device_ids ?? [],
  reportDeviceIds: r.report_device_ids ?? [],
  hidden: r.hidden,
  urgentSentAt: r.urgent_sent_at,
  createdAt: r.created_at,
});
const fromShared = (p: Partial<SharedEventRow>) => {
  const map: Record<string, string> = {
    departmentCode: "department_code",
    createdAt: "created_at",
    startTime: "start_time",
    endTime: "end_time",
    applyUrl: "apply_url",
    isUrgent: "is_urgent",
    registrantDeviceIds: "registrant_device_ids",
    reportDeviceIds: "report_device_ids",
    urgentSentAt: "urgent_sent_at",
  };
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p)) if (k !== "id" && v !== undefined) out[map[k] ?? k] = v;
  return out;
};
const toScheduled = (r: any): ScheduledRow => ({
  id: r.id,
  deviceId: r.device_id,
  key: r.key,
  kind: r.kind,
  notifyAt: r.notify_at,
  expiresAt: r.expires_at,
  title: r.title,
  body: r.body,
  url: r.url,
  sharedEventIds: r.shared_event_ids ?? [],
  sentAt: r.sent_at,
  cancelled: r.cancelled,
});
/* eslint-enable @typescript-eslint/no-explicit-any */

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(`[supabase] ${res.error.message}`);
  return res.data;
}

function supabaseStore(db: SupabaseClient): Store {
  return {
    kind: "supabase",
    async getDevice(id) {
      const data = check(await db.from("devices").select("*").eq("id", id).maybeSingle());
      return data ? toDevice(data) : null;
    },
    async upsertDevice(d) {
      check(
        await db.from("devices").upsert({
          id: d.id,
          department_code: d.departmentCode,
          grade: d.grade,
          urgent_enabled: d.urgentEnabled,
          updated_at: new Date().toISOString(),
        }),
      );
    },
    async setPushSubscription(id, sub) {
      check(await db.from("devices").update({ push_subscription: sub }).eq("id", id));
    },
    async listDevicesInDepartment(code) {
      return (check(await db.from("devices").select("*").eq("department_code", code)) ?? []).map(toDevice);
    },
    async replaceScheduled(deviceId, items) {
      check(await db.from("scheduled_notifications").delete().eq("device_id", deviceId).is("sent_at", null));
      if (items.length === 0) return;
      check(
        await db.from("scheduled_notifications").upsert(
          items.map((i) => ({
            device_id: deviceId,
            key: i.key,
            kind: i.kind,
            notify_at: i.notifyAt,
            expires_at: i.expiresAt,
            title: i.title,
            body: i.body,
            url: i.url,
            shared_event_ids: i.sharedEventIds,
          })),
          { onConflict: "device_id,key", ignoreDuplicates: true },
        ),
      );
    },
    async listDueScheduled(now) {
      return (
        check(
          await db
            .from("scheduled_notifications")
            .select("*")
            .is("sent_at", null)
            .eq("cancelled", false)
            .lte("notify_at", now.toISOString())
            .gt("expires_at", now.toISOString()),
        ) ?? []
      ).map(toScheduled);
    },
    async listPendingScheduled(deviceId) {
      return (
        check(
          await db
            .from("scheduled_notifications")
            .select("*")
            .eq("device_id", deviceId)
            .is("sent_at", null)
            .eq("cancelled", false)
            .order("notify_at"),
        ) ?? []
      ).map(toScheduled);
    },
    async markSent(ids, at) {
      if (ids.length) check(await db.from("scheduled_notifications").update({ sent_at: at.toISOString() }).in("id", ids));
    },
    async cancelScheduledForSharedEvent(sharedEventId, exceptDeviceIds = []) {
      let q = db
        .from("scheduled_notifications")
        .update({ cancelled: true })
        .is("sent_at", null)
        .contains("shared_event_ids", [sharedEventId]);
      if (exceptDeviceIds.length) q = q.not("device_id", "in", `(${exceptDeviceIds.join(",")})`);
      check(await q);
    },
    async listSharedEvents(codes, fromDate) {
      return (
        check(
          await db
            .from("shared_events")
            .select("*")
            .in("department_code", codes)
            .gte("date", fromDate)
            .order("date")
            .order("start_time"),
        ) ?? []
      ).map(toShared);
    },
    async getSharedEvent(id) {
      const data = check(await db.from("shared_events").select("*").eq("id", id).maybeSingle());
      return data ? toShared(data) : null;
    },
    async insertSharedEvent(row) {
      return toShared(check(await db.from("shared_events").insert(fromShared(row)).select("*").single()));
    },
    async updateSharedEvent(id, patch) {
      check(await db.from("shared_events").update(fromShared(patch)).eq("id", id));
    },
  };
}

let cached: Store | null = null;

export function getStore(): Store {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  cached =
    url && key
      ? supabaseStore(createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }))
      : memoryStore;
  return cached;
}
