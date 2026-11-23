import "server-only";
import { z } from "zod";
import { CATEGORY_VALUES } from "../extract/schema";

export const DeviceIdSchema = z.string().uuid();

export const DeviceRequestSchema = z.object({
  deviceId: DeviceIdSchema,
  departmentCode: z.string().max(20).nullable(),
  grade: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).nullable(),
  urgentEnabled: z.boolean(),
});

export const SubscribeRequestSchema = z.object({
  deviceId: DeviceIdSchema,
  subscription: z
    .object({
      endpoint: z.string().url(),
      keys: z.object({ p256dh: z.string(), auth: z.string() }),
    })
    .nullable(),
});

export const ScheduleRequestSchema = z.object({
  deviceId: DeviceIdSchema,
  notifications: z
    .array(
      z.object({
        key: z.string().max(400),
        kind: z.enum(["beforeEvent", "atGoHome", "deptUrgent"]),
        notifyAt: z.string().datetime(),
        expiresAt: z.string().datetime(),
        title: z.string().max(120),
        body: z.string().max(300),
        url: z.string().max(200).startsWith("/"),
        sharedEventIds: z.array(z.string().uuid()).max(20),
      }),
    )
    .max(200),
});

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const ShareRequestSchema = z.object({
  deviceId: DeviceIdSchema,
  scope: z.enum(["grade", "department"]),
  grades: z.array(z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)])).max(4),
  event: z.object({
    title: z.string().trim().min(1).max(100),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    startTime: time.nullable(),
    endTime: time.nullable(),
    location: z.string().max(100).nullable(),
    category: z.enum(CATEGORY_VALUES),
    applyUrl: z.string().url().max(500).nullable(),
  }),
});

export const ReportRequestSchema = z.object({
  deviceId: DeviceIdSchema,
  sharedEventId: z.string().uuid(),
});
