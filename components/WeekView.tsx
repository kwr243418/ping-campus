"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import { EventCard } from "./EventCard";
import { GridLegend, WeekGrid, type GridColumn } from "./WeekGrid";
import { Loading, PageHeader } from "./ui";
import { WEEKDAY_LABEL, addDaysTo, formatShortDate, weekDates, weekStartOf } from "@/lib/dates";
import { isVisibleByInterest, sortByDateTime } from "@/lib/events";
import {
  compareWithTimetable,
  getClassesForDate,
  getGoHomeTime,
  isNotifyTarget,
  overlapsClass,
  planForEvent,
} from "@/lib/schedule";
import { useAppData } from "@/lib/useAppData";

// S06 주간 보기: 시간표 블록 + 행사 블록, 겹침 표시
export function WeekView() {
  const { state, actions } = useAppData();
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!state) return <Loading />;
  const { now, today, timetable, allEvents: events, addedIds, settings, interests } = state;

  const monday = addDaysTo(weekStartOf(today), weekOffset * 7);
  const dates = weekDates(monday);
  const shown = events.filter(
    (e) => isVisibleByInterest(e, interests, addedIds) || (!!e.sharedEventId && e.sharedOrigin !== "homepage"),
  );
  const targets = events.filter((e) =>
    isNotifyTarget(e, { interestCategories: interests, addedEventIds: addedIds, settings }),
  );

  // 일요일에 수업·행사가 없으면 월~토만 보여 좁은 화면에서 칸을 넓힙니다
  const sunday = dates[6];
  const showSunday =
    getClassesForDate(sunday, timetable).length > 0 || shown.some((e) => e.date === sunday);
  const visibleDates = showSunday ? dates : dates.slice(0, 6);

  const columns: GridColumn[] = visibleDates.map((date, i) => {
    const goHome = getGoHomeTime(date, timetable);
    return {
      key: date,
      label: WEEKDAY_LABEL[i + 1],
      sublabel: String(Number(date.slice(8))),
      footnote: goHome ? `~${goHome}` : undefined,
      highlight: date === today,
      classes: getClassesForDate(date, timetable).map((c) => ({
        id: c.id,
        start: c.start,
        end: c.end,
        title: c.name ?? (c.makeup ? "보강" : "수업"),
        sub: c.room,
      })),
      events: shown
        .filter((e) => e.date === date && e.startTime)
        .map((e) => ({
          id: e.id,
          start: e.startTime!,
          end: e.endTime,
          title: e.title,
          overlap: overlapsClass(e, timetable),
        })),
    };
  });

  const weekSet = new Set(visibleDates);
  const untimed = shown.filter((e) => weekSet.has(e.date) && !e.startTime).sort(sortByDateTime);
  const selected = events.find((e) => e.id === selectedId) ?? null;

  return (
    <div>
      <PageHeader
        title="주간"
        right={
          <Link
            href="/timetable"
            className="flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-semibold text-indigo-700 active:bg-indigo-50"
          >
            <Pencil aria-hidden className="size-4" />
            시간표 편집
          </Link>
        }
      />
      <div className="space-y-3 px-3 pt-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setWeekOffset((w) => w - 1)}
            aria-label="이전 주"
            className="grid size-11 place-items-center rounded-full text-slate-700 active:bg-slate-200"
          >
            <ChevronLeft aria-hidden className="size-5" />
          </button>
          <div className="text-center">
            <p className="text-[15px] font-bold text-slate-900">
              {formatShortDate(dates[0])} – {formatShortDate(dates[6])}
            </p>
            {weekOffset !== 0 && (
              <button
                type="button"
                onClick={() => setWeekOffset(0)}
                className="text-xs font-semibold text-indigo-700 underline underline-offset-2"
              >
                이번 주로
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setWeekOffset((w) => w + 1)}
            aria-label="다음 주"
            className="grid size-11 place-items-center rounded-full text-slate-700 active:bg-slate-200"
          >
            <ChevronRight aria-hidden className="size-5" />
          </button>
        </div>

        <GridLegend />

        {untimed.length > 0 && (
          <div className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <p className="font-semibold">시간 확인 필요</p>
            <ul className="mt-1 space-y-1">
              {untimed.map((e) => (
                <li key={e.id}>
                  <button type="button" onClick={() => setSelectedId(e.id)} className="min-h-8 text-left underline-offset-2 hover:underline">
                    {formatShortDate(e.date)} · {e.title}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <WeekGrid
          columns={columns}
          onEventClick={(id) => setSelectedId((cur) => (cur === id ? null : id))}
          selectedEventId={selectedId}
        />

        {selected ? (
          <EventCard
            event={selected}
            today={today}
            fit={compareWithTimetable(selected, timetable)}
            notifications={planForEvent(selected, targets, timetable, settings, now)}
            isTarget={targets.some((t) => t.id === selected.id)}
            added={addedIds.includes(selected.id)}
            onToggleAdd={actions.toggleAdded}
            leadMinutes={settings.beforeEvent.leadMinutes}
          />
        ) : (
          <p className="pb-2 text-center text-sm text-slate-600">행사 블록을 누르면 자세한 내용이 보여요.</p>
        )}
      </div>
    </div>
  );
}
