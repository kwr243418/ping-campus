"use client";

import { useState } from "react";
import { CalendarX2, Plus, Trash2, TriangleAlert } from "lucide-react";
import { TimetableCapture } from "./TimetableCapture";
import { GridLegend, WeekGrid, type GridColumn } from "./WeekGrid";
import {
  BottomSheet,
  Field,
  Loading,
  PageHeader,
  Segmented,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "./ui";
import {
  WEEKDAY_LABEL,
  formatDateLabel,
  isValidDate,
  minutesToTime,
  timeToMinutes,
  weekdayOf,
} from "@/lib/dates";
import { findClassConflict, getGoHomeTime, getWeekdayGoHomeTime } from "@/lib/schedule";
import { useAppData } from "@/lib/useAppData";
import type { ClassBlock, Timetable, TimetableException, Weekday } from "@/lib/types";

const WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5, 6];
const WEEKDAY_OPTIONS = WEEKDAYS.map((w) => ({ value: w, label: WEEKDAY_LABEL[w] }));

const EXCEPTION_LABEL: Record<TimetableException["type"], string> = {
  cancel: "휴강",
  holiday: "공휴일·수업 없음",
  makeup: "보강",
  override: "귀가 시간 직접 지정",
};

type ClassDraft = Omit<ClassBlock, "id"> & { id?: string };

// S08 시간표 편집
export function TimetableEditor() {
  const { state, actions } = useAppData();
  const [exceptionOpen, setExceptionOpen] = useState(false);

  if (!state) return <Loading />;
  const { timetable } = state;
  const save = (next: Timetable) => actions.setTimetable(next);

  const sortedExceptions = [...timetable.exceptions].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="pb-10">
      <PageHeader title="시간표" backHref="/settings" backLabel="설정으로" />
      <div className="space-y-6 px-3 pt-3">
        <TimetableCapture timetable={timetable} onChange={save} />
        <ClassGridEditor timetable={timetable} onChange={save} />

        <section aria-labelledby="semester-title" className="space-y-2 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <h2 id="semester-title" className="text-[15px] font-bold text-slate-900">
            학기 기간
          </h2>
          <p className="text-sm text-slate-600">기간 밖의 날은 수업이 없는 날로 봐요.</p>
          <div className="grid grid-cols-2 gap-2">
            <Field label="시작일">
              <input
                type="date"
                className={inputClass}
                value={timetable.semesterStart}
                onChange={(e) => isValidDate(e.target.value) && save({ ...timetable, semesterStart: e.target.value })}
              />
            </Field>
            <Field label="종료일">
              <input
                type="date"
                className={inputClass}
                value={timetable.semesterEnd}
                onChange={(e) => isValidDate(e.target.value) && save({ ...timetable, semesterEnd: e.target.value })}
              />
            </Field>
          </div>
          {timetable.semesterEnd < timetable.semesterStart && (
            <p className="flex items-center gap-1.5 text-sm font-medium text-orange-800">
              <TriangleAlert aria-hidden className="size-4" />
              종료일이 시작일보다 빨라요.
            </p>
          )}
        </section>

        <section aria-labelledby="exception-title" className="space-y-2 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <div className="flex items-center justify-between">
            <h2 id="exception-title" className="text-[15px] font-bold text-slate-900">
              날짜별 예외
            </h2>
            <button
              type="button"
              onClick={() => setExceptionOpen(true)}
              className="flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-semibold text-indigo-700 active:bg-indigo-50"
            >
              <Plus aria-hidden className="size-4" />
              추가
            </button>
          </div>
          <p className="text-sm text-slate-600">휴강·보강·공휴일을 넣으면 그날 귀가 시간과 알림이 바로 바뀌어요.</p>
          {sortedExceptions.length === 0 ? (
            <p className="flex items-center gap-2 py-2 text-sm text-slate-500">
              <CalendarX2 aria-hidden className="size-4" />
              등록한 예외가 없어요.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {sortedExceptions.map((ex) => {
                const idx = timetable.exceptions.indexOf(ex);
                const cls = ex.classId ? timetable.classes.find((c) => c.id === ex.classId) : undefined;
                const detail =
                  ex.type === "cancel"
                    ? `${cls?.name ?? "수업"} ${cls ? `${cls.start}–${cls.end}` : ""}`
                    : ex.type === "makeup"
                      ? `${ex.start}–${ex.end}`
                      : ex.type === "override"
                        ? `귀가 ${ex.goHomeTime}`
                        : "";
                const goHome = getGoHomeTime(ex.date, timetable);
                return (
                  <li key={`${ex.date}-${idx}`} className="flex items-center gap-2 py-2">
                    <div className="flex-1 text-sm">
                      <p className="font-semibold text-slate-900">
                        {formatDateLabel(ex.date)} · {EXCEPTION_LABEL[ex.type]}
                      </p>
                      <p className="text-slate-600">
                        {detail && `${detail} · `}
                        {goHome ? `이날 귀가 ${goHome}` : "이날 수업 없음"}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label={`${formatDateLabel(ex.date)} ${EXCEPTION_LABEL[ex.type]} 삭제`}
                      onClick={() => save({ ...timetable, exceptions: timetable.exceptions.filter((_, i) => i !== idx) })}
                      className="grid size-11 place-items-center rounded-full text-slate-500 active:bg-slate-100"
                    >
                      <Trash2 aria-hidden className="size-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <ExceptionSheet
        open={exceptionOpen}
        timetable={timetable}
        defaultDate={state.today}
        onClose={() => setExceptionOpen(false)}
        onSave={(ex) => {
          save({ ...timetable, exceptions: [...timetable.exceptions, ex] });
          setExceptionOpen(false);
        }}
      />
    </div>
  );
}

/** 요일×시간 격자에서 수업을 추가·수정·삭제 (시간표 편집·온보딩에서 함께 사용) */
export function ClassGridEditor({
  timetable,
  onChange,
  headingLevel = "h2",
}: {
  timetable: Timetable;
  onChange: (next: Timetable) => void;
  headingLevel?: "h2" | "h3";
}) {
  const [draft, setDraft] = useState<ClassDraft | null>(null);
  const Heading = headingLevel;

  const columns: GridColumn[] = WEEKDAYS.map((w) => {
    const goHome = getWeekdayGoHomeTime(w, timetable);
    return {
      key: String(w),
      label: WEEKDAY_LABEL[w],
      footnote: goHome ? `~${goHome}` : undefined,
      classes: timetable.classes
        .filter((c) => c.weekday === w)
        .map((c) => ({ id: c.id, start: c.start, end: c.end, title: c.name ?? "수업", sub: c.room })),
      events: [],
    };
  });

  return (
    <section aria-labelledby="grid-title" className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <Heading id="grid-title" className="text-[15px] font-bold text-slate-900">
          수업 시간표
        </Heading>
        <button
          type="button"
          onClick={() => setDraft({ weekday: 1, start: "09:00", end: "10:30" })}
          className="flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-semibold text-indigo-700 active:bg-indigo-50"
        >
          <Plus aria-hidden className="size-4" />
          수업 추가
        </button>
      </div>
      <p className="px-1 text-sm text-slate-600">
        빈칸을 누르면 수업을 추가하고, 수업을 누르면 고칠 수 있어요. 요일 아래 시각이 그날 귀가 시간이에요.
      </p>
      <WeekGrid
        columns={columns}
        onEmptyClick={(key, hour) =>
          setDraft({
            weekday: Number(key) as Weekday,
            start: minutesToTime(hour * 60),
            end: minutesToTime(Math.min(hour * 60 + 90, 23 * 60 + 55)),
          })
        }
        onClassClick={(_, id) => {
          const c = timetable.classes.find((x) => x.id === id);
          if (c) setDraft({ ...c });
        }}
      />
      <GridLegend />

      <ClassSheet
        draft={draft}
        timetable={timetable}
        onClose={() => setDraft(null)}
        onSave={(block) => {
          const exists = timetable.classes.some((c) => c.id === block.id);
          onChange({
            ...timetable,
            classes: exists
              ? timetable.classes.map((c) => (c.id === block.id ? block : c))
              : [...timetable.classes, block],
          });
          setDraft(null);
        }}
        onDelete={(id) => {
          onChange({
            ...timetable,
            classes: timetable.classes.filter((c) => c.id !== id),
            exceptions: timetable.exceptions.filter((e) => e.classId !== id),
          });
          setDraft(null);
        }}
      />
    </section>
  );
}

function ClassSheet({
  draft,
  timetable,
  onClose,
  onSave,
  onDelete,
}: {
  draft: ClassDraft | null;
  timetable: Timetable;
  onClose: () => void;
  onSave: (block: ClassBlock) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <BottomSheet open={!!draft} title={draft?.id ? "수업 고치기" : "수업 추가"} onClose={onClose}>
      {draft && (
        <ClassForm key={draft.id ?? `${draft.weekday}-${draft.start}`} draft={draft} timetable={timetable} onSave={onSave} onDelete={onDelete} />
      )}
    </BottomSheet>
  );
}

function ClassForm({
  draft,
  timetable,
  onSave,
  onDelete,
}: {
  draft: ClassDraft;
  timetable: Timetable;
  onSave: (block: ClassBlock) => void;
  onDelete: (id: string) => void;
}) {
  const [form, setForm] = useState<ClassDraft>(draft);
  const invalidRange = !form.start || !form.end || form.end <= form.start;
  const conflict = invalidRange ? undefined : findClassConflict(form, timetable);
  const error = invalidRange
    ? "끝나는 시각이 시작 시각보다 늦어야 해요."
    : conflict
      ? `${WEEKDAY_LABEL[conflict.weekday]}요일 ${conflict.name ?? "수업"}(${conflict.start}–${conflict.end})과 겹쳐요.`
      : null;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (error) return;
        onSave({
          id: form.id ?? crypto.randomUUID(),
          weekday: form.weekday,
          start: form.start,
          end: form.end,
          name: form.name?.trim() || undefined,
          room: form.room?.trim() || undefined,
        });
      }}
    >
      <div>
        <span className="mb-1 block text-sm font-semibold text-slate-700">요일</span>
        <Segmented
          label="요일"
          value={form.weekday}
          options={WEEKDAY_OPTIONS}
          onChange={(weekday) => setForm({ ...form, weekday })}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="시작">
          <input
            type="time"
            step={300}
            required
            className={inputClass}
            value={form.start}
            onChange={(e) => {
              const start = e.target.value;
              // 시작을 옮기면 수업 길이를 유지합니다
              const len = timeToMinutes(form.end) - timeToMinutes(form.start);
              const end = start && len > 0 ? minutesToTime(Math.min(timeToMinutes(start) + len, 23 * 60 + 55)) : form.end;
              setForm({ ...form, start, end });
            }}
          />
        </Field>
        <Field label="끝">
          <input
            type="time"
            step={300}
            required
            className={inputClass}
            value={form.end}
            onChange={(e) => setForm({ ...form, end: e.target.value })}
          />
        </Field>
      </div>
      <Field label="과목명 (선택)">
        <input
          className={inputClass}
          value={form.name ?? ""}
          placeholder="예: 인간컴퓨터상호작용"
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </Field>
      <Field label="강의실 (선택)">
        <input
          className={inputClass}
          value={form.room ?? ""}
          placeholder="예: 공학관 401"
          onChange={(e) => setForm({ ...form, room: e.target.value })}
        />
      </Field>
      {error && (
        <p role="alert" className="flex items-center gap-1.5 text-sm font-medium text-orange-800">
          <TriangleAlert aria-hidden className="size-4 shrink-0" />
          {error}
        </p>
      )}
      <div className="flex gap-2">
        {form.id && (
          <button type="button" onClick={() => onDelete(form.id!)} className={`${secondaryButtonClass} text-red-700`}>
            <Trash2 aria-hidden className="size-4" />
            삭제
          </button>
        )}
        <button type="submit" disabled={!!error} className={primaryButtonClass}>
          저장
        </button>
      </div>
    </form>
  );
}

function ExceptionSheet({
  open,
  timetable,
  defaultDate,
  onClose,
  onSave,
}: {
  open: boolean;
  timetable: Timetable;
  defaultDate: string;
  onClose: () => void;
  onSave: (ex: TimetableException) => void;
}) {
  return (
    <BottomSheet open={open} title="날짜별 예외 추가" onClose={onClose}>
      {open && <ExceptionForm timetable={timetable} defaultDate={defaultDate} onSave={onSave} />}
    </BottomSheet>
  );
}

function ExceptionForm({
  timetable,
  defaultDate,
  onSave,
}: {
  timetable: Timetable;
  defaultDate: string;
  onSave: (ex: TimetableException) => void;
}) {
  const [date, setDate] = useState(defaultDate);
  const [type, setType] = useState<TimetableException["type"]>("cancel");
  const [classId, setClassId] = useState("");
  const [start, setStart] = useState("16:30");
  const [end, setEnd] = useState("18:00");
  const [goHomeTime, setGoHomeTime] = useState("18:00");

  const validDate = isValidDate(date);
  const dayClasses = validDate ? timetable.classes.filter((c) => c.weekday === weekdayOf(date)) : [];
  const candidate: TimetableException | null = !validDate
    ? null
    : type === "cancel"
      ? classId
        ? { date, type, classId }
        : null
      : type === "makeup"
        ? start && end && end > start
          ? { date, type, start, end }
          : null
        : type === "override"
          ? goHomeTime
            ? { date, type, goHomeTime }
            : null
          : { date, type };

  const before = validDate ? getGoHomeTime(date, timetable) : null;
  const after = candidate
    ? getGoHomeTime(date, { ...timetable, exceptions: [...timetable.exceptions, candidate] })
    : before;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (candidate) onSave(candidate);
      }}
    >
      <Field label="날짜">
        <input type="date" required className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label="종류">
        <select
          className={inputClass}
          value={type}
          onChange={(e) => setType(e.target.value as TimetableException["type"])}
        >
          {(Object.keys(EXCEPTION_LABEL) as TimetableException["type"][]).map((t) => (
            <option key={t} value={t}>
              {EXCEPTION_LABEL[t]}
            </option>
          ))}
        </select>
      </Field>

      {type === "cancel" &&
        (dayClasses.length > 0 ? (
          <Field label="휴강하는 수업">
            <select className={inputClass} value={classId} onChange={(e) => setClassId(e.target.value)} required>
              <option value="">수업을 골라 주세요</option>
              {dayClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name ?? "수업"} {c.start}–{c.end}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <p className="text-sm text-slate-600">이 요일에는 등록된 수업이 없어요.</p>
        ))}
      {type === "makeup" && (
        <div className="grid grid-cols-2 gap-2">
          <Field label="보강 시작">
            <input type="time" step={300} className={inputClass} value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="보강 끝">
            <input type="time" step={300} className={inputClass} value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>
      )}
      {type === "override" && (
        <Field label="이날 귀가 시간" hint="예: 수업 후 동아리 모임이 있는 날">
          <input type="time" step={300} className={inputClass} value={goHomeTime} onChange={(e) => setGoHomeTime(e.target.value)} />
        </Field>
      )}

      {validDate && (
        <p className="rounded-xl bg-slate-100 px-3 py-2.5 text-sm text-slate-800">
          {formatDateLabel(date)} 귀가 시간: <strong>{before ?? "수업 없음"}</strong>
          {candidate && after !== before && (
            <>
              {" "}→ <strong className="text-indigo-700">{after ?? "수업 없음"}</strong>
            </>
          )}
        </p>
      )}

      <button type="submit" disabled={!candidate} className={primaryButtonClass}>
        추가
      </button>
    </form>
  );
}
