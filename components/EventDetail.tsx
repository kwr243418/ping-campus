"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, EyeOff, ExternalLink, FileText, Pencil, Share2, Trash2 } from "lucide-react";
import { EventCard } from "./EventCard";
import {
  BottomSheet,
  Field,
  Loading,
  PageHeader,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "./ui";
import { downloadIcs } from "@/lib/client/download";
import { reportShared } from "@/lib/client/share";
import { formatDateLabel, isValidDate, isValidTime } from "@/lib/dates";
import { computeMissingFields } from "@/lib/events";
import { googleCalendarUrl } from "@/lib/ics";
import { compareWithTimetable, isNotifyTarget, planForEvent } from "@/lib/schedule";
import { useAppData } from "@/lib/useAppData";
import { CATEGORY_LABEL, type Category, type Event } from "@/lib/types";

// S05 이벤트 상세
export function EventDetail({ id }: { id: string }) {
  const router = useRouter();
  const { state, actions } = useAppData();
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!state) return <Loading />;
  const { now, today, timetable, allEvents, addedIds, settings, interests, feed } = state;
  const event = allEvents.find((e) => e.id === id);

  if (!event) {
    return (
      <div>
        <PageHeader title="행사" backHref="/" backLabel="홈으로" />
        <div className="px-4 pt-10 text-center">
          <p className="text-[15px] font-semibold text-slate-800">행사를 찾지 못했어요</p>
          <p className="mt-1 text-sm text-slate-600">지났거나 숨긴 행사일 수 있어요. 우리 학과 행사는 잠시 뒤 다시 열어 보세요.</p>
          <Link href="/" className="mt-3 inline-flex min-h-11 items-center px-3 text-sm font-semibold text-indigo-700">
            홈으로 가기
          </Link>
        </div>
      </div>
    );
  }

  const own = state.events.some((e) => e.id === event.id);
  const shared = event.sharedEventId ? feed.find((f) => f.id === event.sharedEventId) : undefined;
  const targets = allEvents.filter((e) =>
    isNotifyTarget(e, { interestCategories: interests, addedEventIds: addedIds, settings }),
  );

  async function report(sharedId: string) {
    if (!window.confirm("이 행사 정보가 틀렸다고 신고할까요? 두 명 이상 신고하면 피드에서 숨겨져요.")) return;
    try {
      const r = await reportShared(sharedId);
      setMessage(r.hidden ? "신고가 모여 피드에서 숨겼어요." : "신고했어요. 고마워요.");
    } catch (e) {
      setMessage((e as Error).message);
    }
  }

  const rows: [string, React.ReactNode][] = [
    ["주최", event.organizer],
    ["대상", event.target],
    ["신청 마감", event.applyDeadline],
    ["요약", event.summary],
  ].filter((r): r is [string, string] => !!r[1]);

  return (
    <div className="pb-10">
      <PageHeader title="행사" backHref="/" backLabel="홈으로" />
      <div className="space-y-4 px-4 pt-4">
        {message && (
          <p role="status" className="rounded-xl bg-slate-800 px-4 py-3 text-sm font-medium text-white">
            {message}
          </p>
        )}

        <EventCard
          event={event}
          today={today}
          fit={compareWithTimetable(event, timetable)}
          notifications={planForEvent(event, targets, timetable, settings, now)}
          isTarget={targets.some((t) => t.id === event.id)}
          added={addedIds.includes(event.id)}
          onToggleAdd={actions.toggleAdded}
          leadMinutes={settings.beforeEvent.leadMinutes}
          shared={shared}
          onReport={report}
        />

        {own && event.sharedEventId && (
          <p className="flex items-center gap-2 rounded-xl bg-indigo-50 px-3 py-2.5 text-sm text-indigo-900">
            <Share2 aria-hidden className="size-4 shrink-0" />
            우리 학과에 공유한 행사예요{shared ? ` · ${shared.registrantCount}명이 등록했어요` : ""}.
          </p>
        )}

        {(rows.length > 0 || event.applyUrl) && (
          <dl className="divide-y divide-slate-100 rounded-2xl bg-white px-4 ring-1 ring-slate-200">
            {rows.map(([k, v]) => (
              <div key={k} className="flex gap-3 py-3 text-sm">
                <dt className="w-16 shrink-0 font-semibold text-slate-600">{k}</dt>
                <dd className="text-slate-900">{v}</dd>
              </div>
            ))}
            {event.applyUrl && (
              <div className="flex gap-3 py-3 text-sm">
                <dt className="w-16 shrink-0 font-semibold text-slate-600">신청</dt>
                <dd>
                  <a
                    href={event.applyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold break-all text-indigo-700 underline underline-offset-2"
                  >
                    신청 페이지 열기
                    <ExternalLink aria-hidden className="size-3.5 shrink-0" />
                  </a>
                </dd>
              </div>
            )}
          </dl>
        )}

        {own && event.rawText && (
          <details className="rounded-2xl bg-white px-4 ring-1 ring-slate-200">
            <summary className="flex min-h-12 cursor-pointer items-center gap-2 text-sm font-semibold text-slate-800">
              <FileText aria-hidden className="size-4" />
              원문 보기
            </summary>
            <p className="pb-4 text-sm leading-relaxed whitespace-pre-wrap text-slate-700">{event.rawText}</p>
          </details>
        )}

        <div className="grid grid-cols-2 gap-2">
          <a
            href={googleCalendarUrl(event)}
            target="_blank"
            rel="noopener noreferrer"
            className={`${secondaryButtonClass} text-sm`}
          >
            <ExternalLink aria-hidden className="size-4" />
            Google 캘린더
          </a>
          <button
            type="button"
            onClick={() => downloadIcs([event], now, `${event.date}-${event.title.slice(0, 20)}.ics`)}
            className={`${secondaryButtonClass} text-sm`}
          >
            <Download aria-hidden className="size-4" />
            .ics 받기
          </button>
          {own && (
            <button type="button" onClick={() => setEditing(true)} className={`${secondaryButtonClass} text-sm`}>
              <Pencil aria-hidden className="size-4" />
              편집
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (!window.confirm("관심 없는 행사로 숨길까요? 목록과 알림에서 빠져요.")) return;
              actions.dismissEvent(event.id);
              router.replace("/");
            }}
            className={`${secondaryButtonClass} text-sm`}
          >
            <EyeOff aria-hidden className="size-4" />
            관심 없음
          </button>
          {own && (
            <button
              type="button"
              onClick={() => {
                if (!window.confirm("이 행사를 삭제할까요?")) return;
                actions.deleteEvent(event.id);
                router.replace("/");
              }}
              className={`${secondaryButtonClass} col-span-2 text-sm text-red-700`}
            >
              <Trash2 aria-hidden className="size-4" />
              삭제
            </button>
          )}
        </div>
        {own && event.sharedEventId && (
          <p className="text-xs text-slate-600">편집·삭제는 내 기기에만 반영돼요. 공유한 정보가 틀렸다면 학과 친구들이 신고할 수 있어요.</p>
        )}
      </div>

      <BottomSheet open={editing} title="행사 편집" onClose={() => setEditing(false)}>
        {editing && (
          <EditForm
            event={event}
            onSave={(patch) => {
              actions.updateEvent(event.id, patch);
              setEditing(false);
              setMessage("고쳤어요. 알림도 다시 계산했어요.");
            }}
          />
        )}
      </BottomSheet>
    </div>
  );
}

function EditForm({ event, onSave }: { event: Event; onSave: (patch: Partial<Event>) => void }) {
  const [f, setF] = useState({
    title: event.title,
    date: event.date,
    startTime: event.startTime ?? "",
    endTime: event.endTime ?? "",
    location: event.location ?? "",
    category: event.category,
  });
  const valid = f.title.trim() && isValidDate(f.date);
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        const patch = {
          title: f.title.trim(),
          date: f.date,
          startTime: isValidTime(f.startTime) ? f.startTime : undefined,
          endTime: isValidTime(f.endTime) && f.endTime > f.startTime ? f.endTime : undefined,
          location: f.location.trim() || undefined,
          category: f.category,
        };
        onSave({ ...patch, missingFields: computeMissingFields(patch) });
      }}
    >
      <Field label="제목">
        <input className={inputClass} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="날짜">
          <input type="date" className={inputClass} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        </Field>
        <Field label="카테고리">
          <select className={inputClass} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as Category })}>
            {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="시작">
          <input type="time" step={300} className={inputClass} value={f.startTime} onChange={(e) => setF({ ...f, startTime: e.target.value })} />
        </Field>
        <Field label="끝 (선택)">
          <input type="time" step={300} className={inputClass} value={f.endTime} onChange={(e) => setF({ ...f, endTime: e.target.value })} />
        </Field>
      </div>
      <Field label="장소">
        <input className={inputClass} value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} />
      </Field>
      {isValidDate(f.date) && (
        <p className="text-sm text-slate-600">{formatDateLabel(f.date)}로 저장해요.</p>
      )}
      <button type="submit" disabled={!valid} className={primaryButtonClass}>
        저장
      </button>
    </form>
  );
}
