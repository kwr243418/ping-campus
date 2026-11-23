"use client";

import { TriangleAlert } from "lucide-react";
import { timeToMinutes } from "@/lib/dates";

export interface GridClass {
  id: string;
  start: string;
  end: string;
  title?: string;
  sub?: string;
}

export interface GridEvent {
  id: string;
  start: string;
  end?: string;
  title: string;
  overlap: boolean;
}

export interface GridColumn {
  key: string;
  label: string;
  sublabel?: string;
  footnote?: string;
  highlight?: boolean;
  classes: GridClass[];
  events: GridEvent[];
}

const HOUR_PX = 48;

export function WeekGrid({
  columns,
  startHour = 8,
  endHour = 22,
  onClassClick,
  onEventClick,
  onEmptyClick,
  selectedEventId,
}: {
  columns: GridColumn[];
  startHour?: number;
  endHour?: number;
  onClassClick?: (columnKey: string, classId: string) => void;
  onEventClick?: (eventId: string) => void;
  onEmptyClick?: (columnKey: string, hour: number) => void;
  selectedEventId?: string | null;
}) {
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const totalPx = hours.length * HOUR_PX;

  const pos = (start: string, end?: string) => {
    const s = Math.max(timeToMinutes(start), startHour * 60);
    const eRaw = end && end > start ? timeToMinutes(end) : timeToMinutes(start) + 60;
    const e = Math.min(eRaw, endHour * 60);
    return {
      top: ((s - startHour * 60) / 60) * HOUR_PX,
      height: Math.max(((e - s) / 60) * HOUR_PX, 20),
    };
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {/* 요일 머리글 */}
      <div
        className="sticky top-0 z-[5] grid border-b border-slate-200 bg-white"
        style={{ gridTemplateColumns: `2rem repeat(${columns.length}, minmax(0, 1fr))` }}
      >
        <span />
        {columns.map((c) => (
          <div
            key={c.key}
            className={`flex flex-col items-center py-1.5 text-center ${c.highlight ? "bg-indigo-50" : ""}`}
          >
            <span className={`text-xs font-bold ${c.highlight ? "text-indigo-700" : "text-slate-800"}`}>
              {c.label}
            </span>
            {c.sublabel && (
              <span className={`text-[11px] ${c.highlight ? "font-semibold text-indigo-700" : "text-slate-600"}`}>
                {c.sublabel}
              </span>
            )}
            {c.footnote && <span className="text-[10px] font-medium text-slate-600">{c.footnote}</span>}
          </div>
        ))}
      </div>

      <div
        className="relative grid"
        style={{ gridTemplateColumns: `2rem repeat(${columns.length}, minmax(0, 1fr))`, height: totalPx }}
      >
        {/* 시간 축 */}
        <div className="relative">
          {hours.map((h, i) => (
            <span
              key={h}
              className="absolute right-1 -translate-y-1/2 text-[10px] text-slate-500"
              style={{ top: i * HOUR_PX }}
            >
              {i === 0 ? "" : h}
            </span>
          ))}
        </div>

        {columns.map((c) => (
          <div key={c.key} className={`relative border-l border-slate-100 ${c.highlight ? "bg-indigo-50/40" : ""}`}>
            {hours.map((h, i) =>
              onEmptyClick ? (
                <button
                  key={h}
                  type="button"
                  aria-label={`${c.label}요일 ${h}시에 수업 추가`}
                  onClick={() => onEmptyClick(c.key, h)}
                  className="absolute inset-x-0 border-t border-slate-100 hover:bg-slate-50 active:bg-slate-100"
                  style={{ top: i * HOUR_PX, height: HOUR_PX }}
                />
              ) : (
                <div
                  key={h}
                  className="absolute inset-x-0 border-t border-slate-100"
                  style={{ top: i * HOUR_PX, height: HOUR_PX }}
                />
              ),
            )}

            {c.classes.map((b) => {
              const p = pos(b.start, b.end);
              const label = `수업 ${b.title ?? ""} ${b.start}–${b.end}`;
              const inner = (
                <>
                  <span className="block truncate font-semibold">{b.title ?? "수업"}</span>
                  {p.height > 40 && <span className="block truncate">{b.sub}</span>}
                </>
              );
              const cls =
                "absolute inset-x-0.5 overflow-hidden rounded-md border border-slate-300 bg-slate-200 px-1 py-0.5 text-left text-[10px] leading-tight text-slate-800";
              return onClassClick ? (
                <button
                  key={b.id}
                  type="button"
                  aria-label={`${label} 수정`}
                  onClick={() => onClassClick(c.key, b.id)}
                  className={`${cls} active:bg-slate-300`}
                  style={{ top: p.top, height: p.height }}
                >
                  {inner}
                </button>
              ) : (
                <div key={b.id} aria-label={label} className={cls} style={{ top: p.top, height: p.height }}>
                  {inner}
                </div>
              );
            })}

            {c.events.map((ev) => {
              const p = pos(ev.start, ev.end);
              const selected = selectedEventId === ev.id;
              return (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => onEventClick?.(ev.id)}
                  aria-label={`행사 ${ev.title} ${ev.start}${ev.overlap ? ", 수업과 겹쳐요" : ""}`}
                  aria-pressed={selected}
                  className={`absolute right-0.5 left-2 z-[2] overflow-hidden rounded-md px-1 py-0.5 text-left text-[10px] leading-tight font-semibold text-white shadow-sm ${
                    ev.overlap ? "bg-orange-700" : "bg-indigo-600"
                  } ${selected ? "ring-2 ring-slate-900 ring-offset-1" : ""}`}
                  style={{ top: p.top, height: p.height }}
                >
                  {ev.overlap && <TriangleAlert aria-hidden className="mb-0.5 size-3" />}
                  <span className="line-clamp-3">{ev.title}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export function GridLegend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-700">
      <li className="flex items-center gap-1.5">
        <span className="size-3 rounded-sm border border-slate-300 bg-slate-200" />
        수업
      </li>
      <li className="flex items-center gap-1.5">
        <span className="size-3 rounded-sm bg-indigo-600" />
        행사
      </li>
      <li className="flex items-center gap-1.5">
        <TriangleAlert aria-hidden className="size-3 text-orange-700" />
        <span className="size-3 rounded-sm bg-orange-700" />
        수업과 겹치는 행사
      </li>
    </ul>
  );
}
