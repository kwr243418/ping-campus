"use client";

import Link from "next/link";
import {
  Bell,
  BellOff,
  CalendarCheck,
  CalendarDays,
  CalendarPlus,
  CircleCheck,
  Clock,
  Coffee,
  Flag,
  Globe,
  MapPin,
  Timer,
  TriangleAlert,
  Users,
  Zap,
} from "lucide-react";
import { dDayLabel, formatDateLabel, leadLabel, toTimeString } from "@/lib/dates";
import type { TimetableFit } from "@/lib/schedule";
import type { SharedFeedItem } from "@/lib/share";
import { CATEGORY_LABEL, type Event, type PlannedNotification, type Source } from "@/lib/types";

const SOURCE_LABEL: Record<Source, string> = {
  kakao: "카톡",
  homepage: "홈페이지",
  everytime: "에브리타임",
  offline: "포스터",
  link: "링크",
  other: "기타",
};

export interface EventCardProps {
  event: Event;
  today: string;
  fit: TimetableFit;
  /** 이 행사의 알림 예정 (lib/schedule.ts planForEvent 결과) */
  notifications: PlannedNotification[];
  /** 알림 대상 행사인지 (관심 카테고리·내 일정·공유) */
  isTarget: boolean;
  added: boolean;
  onToggleAdd: (eventId: string) => void;
  /** 알림 A 리드 타임 (분) */
  leadMinutes?: number;
  /** 카드 아래 추가 동작 (캘린더 내보내기 등) */
  footer?: React.ReactNode;
  /** 공유받은 행사 정보 (FR-11) */
  shared?: SharedFeedItem;
  onReport?: (sharedEventId: string) => void;
}

export function EventCard({
  event,
  today,
  fit,
  notifications,
  isTarget,
  added,
  onToggleAdd,
  leadMinutes = 60,
  footer,
  shared,
  onReport,
}: EventCardProps) {
  const missing = new Set(event.missingFields);
  const timeText = event.startTime
    ? `${event.startTime}${event.endTime ? ` – ${event.endTime}` : ""}`
    : null;
  const dday = dDayLabel(event.date, today);

  return (
    <article
      aria-labelledby={`${event.id}-title`}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.06)]"
    >
      <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold">
        <span className="rounded-md bg-indigo-50 px-2 py-1 text-indigo-700">
          {CATEGORY_LABEL[event.category]}
        </span>
        {shared?.urgentSentAt ? (
          <span className="flex items-center gap-0.5 rounded-md bg-amber-100 px-2 py-1 text-amber-900">
            <Zap aria-hidden className="size-3.5" />
            우리 학과 긴급
          </span>
        ) : (
          <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-600">
            {shared ? (shared.origin === "homepage" ? "학교 홈페이지" : "우리 학과") : SOURCE_LABEL[event.source]}
          </span>
        )}
        <span
          className={`ml-auto rounded-md px-2 py-1 ${
            dday === "오늘" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700"
          }`}
        >
          {dday}
        </span>
      </div>

      {/* 날짜·시간·장소 3요소 — 카드에서 가장 크게 (FR-4, I02) */}
      <dl className="space-y-1.5 text-[19px] leading-snug font-bold tracking-tight text-slate-900">
        <div className="flex items-center gap-2.5">
          <dt className="sr-only">날짜</dt>
          <CalendarDays aria-hidden className="size-5 shrink-0 text-indigo-600" />
          <dd>{formatDateLabel(event.date)}</dd>
        </div>
        <div className="flex items-center gap-2.5">
          <dt className="sr-only">시간</dt>
          <Clock aria-hidden className="size-5 shrink-0 text-indigo-600" />
          <dd className="flex flex-wrap items-center gap-2">
            {timeText ?? <span className="text-slate-500">시간 미정</span>}
            {!timeText && <NeedsCheckBadge />}
          </dd>
        </div>
        <div className="flex items-center gap-2.5">
          <dt className="sr-only">장소</dt>
          <MapPin aria-hidden className="size-5 shrink-0 text-indigo-600" />
          <dd className="flex flex-wrap items-center gap-2">
            {event.location && !missing.has("location") ? (
              event.location
            ) : (
              <>
                <span className="text-slate-500">장소 미정</span>
                <NeedsCheckBadge />
              </>
            )}
          </dd>
        </div>
      </dl>

      <h3 id={`${event.id}-title`} className="mt-3 text-base font-semibold text-slate-800">
        <Link href={`/event/${encodeURIComponent(event.id)}`} className="underline-offset-2 hover:underline">
          {event.title}
        </Link>
      </h3>
      {event.organizer && <p className="mt-0.5 text-sm text-slate-600">{event.organizer}</p>}
      {shared && <SharedInfo shared={shared} onReport={onReport} />}

      <FitLine fit={fit} startTime={event.startTime} />
      <NotifyLine
        eventId={event.id}
        notifications={notifications}
        isTarget={isTarget}
        fit={fit}
        leadMinutes={leadMinutes}
      />

      <button
        type="button"
        onClick={() => onToggleAdd(event.id)}
        aria-pressed={added}
        className={`mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
          added
            ? "border border-indigo-200 bg-indigo-50 text-indigo-700"
            : "bg-indigo-600 text-white active:bg-indigo-700"
        }`}
      >
        {added ? (
          <>
            <CalendarCheck aria-hidden className="size-5" />
            내 일정에 담았어요
          </>
        ) : (
          <>
            <CalendarPlus aria-hidden className="size-5" />
            일정에 추가
          </>
        )}
      </button>
      {footer}
    </article>
  );
}

/** 공유 행사 신뢰 신호: 등록 인원수, 출처 라벨, 신고 (등록자 정보는 보여 주지 않음) */
export function SharedInfo({ shared, onReport }: { shared: SharedFeedItem; onReport?: (id: string) => void }) {
  if (shared.origin === "homepage") {
    return (
      <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-600">
        <Globe aria-hidden className="size-3.5" />
        학교 홈페이지 공지에서 가져왔어요 · 원문 공지를 확인하세요
      </p>
    );
  }
  return (
    <div className="mt-2 space-y-1.5">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <span className="flex items-center gap-1 rounded-md bg-indigo-50 px-1.5 py-0.5 font-semibold text-indigo-800">
          <Users aria-hidden className="size-3.5" />
          {shared.registrantCount}명이 등록했어요
        </span>
        <span className="text-slate-600">학생이 등록한 정보예요 · 원문 공지를 확인하세요</span>
      </p>
      {!shared.mine && onReport && (
        <button
          type="button"
          disabled={shared.reportedByMe}
          onClick={() => onReport(shared.id)}
          className="flex min-h-11 items-center gap-1 text-xs font-semibold text-slate-600 underline-offset-2 hover:underline disabled:no-underline disabled:opacity-70"
        >
          <Flag aria-hidden className="size-3.5" />
          {shared.reportedByMe ? "신고했어요" : "정보가 틀려요"}
        </button>
      )}
    </div>
  );
}

function NeedsCheckBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-900">
      <TriangleAlert aria-hidden className="size-3.5" />
      확인 필요
    </span>
  );
}

/** 시간표 비교 줄 — 색 + 아이콘 + 텍스트로 상태 표시 */
export function FitLine({ fit, startTime }: { fit: TimetableFit; startTime?: string }) {
  const base = "mt-3 flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm font-medium";
  switch (fit.kind) {
    case "afterClass":
      return (
        <p className={`${base} bg-emerald-50 text-emerald-800`}>
          <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>
            마지막 수업 {fit.goHomeTime} 종료 → {startTime} 시작 · <strong>수업 후 참석 가능</strong>
          </span>
        </p>
      );
    case "sameTime":
      return (
        <p className={`${base} bg-sky-50 text-sky-800`}>
          <Timer aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>
            마지막 수업 {fit.goHomeTime} 종료와 동시에 시작해요 · <strong>바로 이동하면 참석 가능</strong>
          </span>
        </p>
      );
    case "overlap":
      return (
        <p className={`${base} bg-orange-50 text-orange-800`}>
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>
            <strong>수업 시간과 겹쳐요</strong> (마지막 수업 {fit.goHomeTime} 종료)
          </span>
        </p>
      );
    case "noClass":
      return (
        <p className={`${base} bg-slate-100 text-slate-700`}>
          <Coffee aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>이날은 수업이 없어요</span>
        </p>
      );
    case "noTime":
      return (
        <p className={`${base} bg-amber-50 text-amber-900`}>
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>
            <strong>시간 확인 필요</strong> · 시작 시각이 있어야 수업과 비교할 수 있어요
          </span>
        </p>
      );
  }
}

/** 알림 예정 시각 줄 — A(1시간 전), B(귀가 시간) */
export function NotifyLine({
  eventId,
  notifications,
  isTarget,
  fit,
  leadMinutes = 60,
  untargetedPrefix = "일정에 추가하면 ",
}: {
  eventId: string;
  notifications: PlannedNotification[];
  isTarget: boolean;
  fit: TimetableFit;
  leadMinutes?: number;
  untargetedPrefix?: string;
}) {
  if (fit.kind === "noTime") {
    return (
      <p className="mt-2 flex items-center gap-2 px-1 text-sm text-slate-600">
        <BellOff aria-hidden className="size-4 shrink-0" />
        시작 시각을 입력하면 알려 드릴게요
      </p>
    );
  }
  if (notifications.length === 0) {
    return (
      <p className="mt-2 flex items-center gap-2 px-1 text-sm text-slate-600">
        <BellOff aria-hidden className="size-4 shrink-0" />
        보낼 알림이 없어요 (이미 시작했거나 알림이 꺼져 있어요)
      </p>
    );
  }

  return (
    <div className="mt-2 px-1 text-sm text-slate-700">
      <p className="flex items-start gap-2">
        <Bell
          aria-hidden
          className={`mt-0.5 size-4 shrink-0 ${isTarget ? "text-indigo-600" : "text-slate-500"}`}
        />
        <span>
          {!isTarget && <span className="text-slate-600">{untargetedPrefix}</span>}
          {notifications.map((n, i) => (
            <span key={`${n.kind}-${i}`}>
              {i > 0 && ", "}
              <strong className="font-semibold text-slate-900">{toTimeString(n.notifyAt)}</strong>
              <span className="text-slate-600"> ({notifyLabel(n, eventId, leadMinutes)})</span>
            </span>
          ))}
          에 알려 드려요
        </span>
      </p>
    </div>
  );
}

function notifyLabel(n: PlannedNotification, eventId: string, leadMinutes: number): string {
  if (n.kind === "atGoHome") {
    return n.mergedBeforeEventIds?.includes(eventId)
      ? `귀가 시간 · ${leadLabel(leadMinutes)} 알림과 합침`
      : "귀가 시간";
  }
  if (n.kind === "deptUrgent") return "우리 학과 긴급";
  return leadLabel(leadMinutes);
}
