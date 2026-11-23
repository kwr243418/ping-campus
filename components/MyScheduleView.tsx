"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, BookmarkPlus, Bus, CalendarPlus, Download, ExternalLink } from "lucide-react";
import { EventCard } from "./EventCard";
import { Loading, PageHeader } from "./ui";
import { formatShortDate, leadLabel, toDateString, toTimeString } from "@/lib/dates";
import { sortByDateTime } from "@/lib/events";
import { googleCalendarUrl } from "@/lib/ics";
import { downloadIcs } from "@/lib/client/download";
import {
  compareWithTimetable,
  isNotifyTarget,
  planForEvent,
  upcomingNotifications,
} from "@/lib/schedule";
import { useAppData } from "@/lib/useAppData";
import type { Event, PlannedNotification } from "@/lib/types";

// S07 내 일정: 담은 행사, 알림 예정 시각
export function MyScheduleView() {
  const { state, actions } = useAppData();
  const [showPast, setShowPast] = useState(false);
  const [showAllAlerts, setShowAllAlerts] = useState(false);

  if (!state) return <Loading />;
  const { now, today, timetable, allEvents: events, addedIds, settings, interests } = state;

  const mine = events.filter((e) => addedIds.includes(e.id)).sort(sortByDateTime);
  const upcomingMine = mine.filter((e) => e.date >= today);
  const pastMine = mine.filter((e) => e.date < today).reverse();
  const targets = events.filter((e) =>
    isNotifyTarget(e, { interestCategories: interests, addedEventIds: addedIds, settings }),
  );
  const alerts = upcomingNotifications(targets, timetable, settings, now, today);
  const shownAlerts = showAllAlerts ? alerts : alerts.slice(0, 5);
  const byId = new Map(events.map((e) => [e.id, e]));

  const renderCard = (e: Event) => (
    <EventCard
      key={e.id}
      event={e}
      today={today}
      fit={compareWithTimetable(e, timetable)}
      notifications={planForEvent(e, targets, timetable, settings, now)}
      isTarget={targets.some((t) => t.id === e.id)}
      added
      onToggleAdd={actions.toggleAdded}
      leadMinutes={settings.beforeEvent.leadMinutes}
      footer={
        <div className="mt-2 grid grid-cols-2 gap-2">
          <a
            href={googleCalendarUrl(e)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-800 active:bg-slate-100"
          >
            <ExternalLink aria-hidden className="size-4" />
            Google 캘린더
          </a>
          <button
            type="button"
            onClick={() => downloadIcs([e], now, `${e.date}-${e.title.slice(0, 20)}.ics`)}
            className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-800 active:bg-slate-100"
          >
            <Download aria-hidden className="size-4" />
            .ics 받기
          </button>
        </div>
      }
    />
  );

  return (
    <div>
      <PageHeader
        title="내 일정"
        right={
          upcomingMine.length > 0 ? (
            <button
              type="button"
              onClick={() => downloadIcs(upcomingMine, now, `ping-campus-${today}.ics`)}
              className="flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-semibold text-indigo-700 active:bg-indigo-50"
            >
              <CalendarPlus aria-hidden className="size-4" />
              모두 내보내기
            </button>
          ) : undefined
        }
      />

      <div className="space-y-6 px-4 pt-4">
        <section aria-labelledby="alerts-title">
          <h2 id="alerts-title" className="mb-1 text-[15px] font-bold text-slate-900">
            앞으로 받을 알림
          </h2>
          <p className="mb-2 text-sm text-slate-600">관심 분야 행사와 내 일정에 담은 행사 기준이에요.</p>
          {alerts.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-5 text-center text-sm text-slate-600">
              예정된 알림이 없어요.
            </p>
          ) : (
            <ol className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
              {shownAlerts.map((n, i) => (
                <AlertRow key={i} n={n} byId={byId} leadMinutes={settings.beforeEvent.leadMinutes} />
              ))}
            </ol>
          )}
          {alerts.length > 5 && (
            <button
              type="button"
              onClick={() => setShowAllAlerts((v) => !v)}
              className="mt-1 min-h-11 w-full text-sm font-semibold text-slate-600"
            >
              {showAllAlerts ? "접기" : `알림 ${alerts.length - 5}건 더 보기`}
            </button>
          )}
        </section>

        <section aria-labelledby="mine-title">
          <h2 id="mine-title" className="mb-2 text-[15px] font-bold text-slate-900">
            담은 행사 {upcomingMine.length}건
          </h2>
          {upcomingMine.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-8 text-center">
              <BookmarkPlus aria-hidden className="size-8 text-slate-500" />
              <p className="text-[15px] font-semibold text-slate-800">아직 담은 행사가 없어요</p>
              <p className="text-sm text-slate-600">홈에서 행사 카드의 &lsquo;일정에 추가&rsquo;를 눌러 보세요.</p>
              <Link href="/" className="mt-1 min-h-11 px-3 py-2.5 text-sm font-semibold text-indigo-700">
                홈으로 가기
              </Link>
            </div>
          ) : (
            <div className="space-y-3">{upcomingMine.map(renderCard)}</div>
          )}
        </section>

        {pastMine.length > 0 && (
          <section>
            <button
              type="button"
              onClick={() => setShowPast((v) => !v)}
              className="min-h-11 w-full text-sm font-semibold text-slate-600"
              aria-expanded={showPast}
            >
              {showPast ? "지난 행사 접기" : `지난 행사 ${pastMine.length}건 보기`}
            </button>
            {showPast && <div className="mt-2 space-y-3 opacity-80">{pastMine.map(renderCard)}</div>}
          </section>
        )}
      </div>
    </div>
  );
}

function AlertRow({
  n,
  byId,
  leadMinutes,
}: {
  n: PlannedNotification;
  byId: Map<string, Event>;
  leadMinutes: number;
}) {
  const evs = n.eventIds.map((id) => byId.get(id)).filter((e): e is Event => !!e);
  const first = evs[0];
  if (!first) return null;
  const isHome = n.kind === "atGoHome";
  const merged = (n.mergedBeforeEventIds?.length ?? 0) > 0;
  return (
    <li className="flex gap-3 px-3.5 py-3">
      <div className="w-16 shrink-0 text-center">
        <p className="text-xs text-slate-600">{formatShortDate(toDateString(n.notifyAt))}</p>
        <p className="text-base font-bold text-slate-900">{toTimeString(n.notifyAt)}</p>
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={`mb-0.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold ${
            isHome ? "bg-emerald-50 text-emerald-800" : "bg-indigo-50 text-indigo-700"
          }`}
        >
          {isHome ? <Bus aria-hidden className="size-3.5" /> : <Bell aria-hidden className="size-3.5" />}
          {isHome ? `귀가 시간 알림${merged ? ` · ${leadLabel(leadMinutes)} 합침` : ""}` : `${leadLabel(leadMinutes)} 알림`}
        </p>
        <p className="truncate text-sm text-slate-800">
          {isHome
            ? `수업 끝! 오늘 열리는 행사 ${evs.length}개 · ${first.startTime} ${first.title}${evs.length > 1 ? ` 외 ${evs.length - 1}건` : ""}`
            : `${first.startTime} · ${first.location ?? "장소 미정"} · ${first.title}`}
        </p>
      </div>
    </li>
  );
}
