"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ClipboardPaste,
  Copy,
  ImagePlus,
  Link2,
  Loader2,
  CircleCheck,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Type,
  Zap,
  X,
} from "lucide-react";
import { FitLine, NotifyLine } from "./EventCard";
import {
  Field,
  Loading,
  PageHeader,
  Segmented,
  Switch,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "./ui";
import { formatDateLabel, isValidDate, isValidTime } from "@/lib/dates";
import { computeMissingFields, findDuplicate } from "@/lib/events";
import type { ExtractResponse, ExtractedEvent } from "@/lib/extract/schema";
import { compareWithTimetable, isNotifyTarget, planForEvent } from "@/lib/schedule";
import { imageToBase64 } from "@/lib/client/image";
import { shareEvent, type ShareResult } from "@/lib/client/share";
import { defaultShareOn, suggestScope, type Grade, type ShareScope } from "@/lib/share";
import { useAppData } from "@/lib/useAppData";
import { CATEGORY_LABEL, type Category, type Event, type Source } from "@/lib/types";

type Mode = "text" | "image" | "link";

const MODE_OPTIONS = [
  { value: "text", label: "텍스트" },
  { value: "image", label: "이미지" },
  { value: "link", label: "링크" },
] as const;

const SOURCE_OPTIONS: { value: Source; label: string }[] = [
  { value: "kakao", label: "카톡" },
  { value: "homepage", label: "홈페이지" },
  { value: "everytime", label: "에브리타임" },
  { value: "offline", label: "포스터" },
  { value: "other", label: "기타" },
];

interface Draft {
  key: string;
  include: boolean;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  organizer: string;
  category: Category;
  applyUrl: string;
  target: string;
  summary: string;
  confidence: ExtractedEvent["confidence"];
  /** 우리 학과에 공유 (촉박하면 자동으로 켜짐) */
  share: boolean;
  urgent: boolean;
  scope: ShareScope;
  grades: Grade[];
}

function toDraft(e: ExtractedEvent, i: number, now: Date, grade: Grade | null, canShare: boolean): Draft {
  const urgent = !!e.date && defaultShareOn({ date: e.date, startTime: e.startTime }, now);
  const { scope, grades } = suggestScope(e.target, grade);
  return {
    key: `d${i}`,
    include: true,
    title: e.title,
    date: e.date ?? "",
    startTime: e.startTime ?? "",
    endTime: e.endTime ?? "",
    location: e.location ?? "",
    organizer: e.organizer ?? "",
    category: e.category,
    applyUrl: e.applyUrl ?? "",
    target: e.target ?? "",
    summary: e.summary ?? "",
    confidence: e.confidence,
    share: canShare && urgent,
    urgent,
    scope,
    grades,
  };
}

function draftToEvent(d: Draft, source: Source, rawText: string, createdAt: string, id: string): Event {
  const opt = (v: string) => (v.trim() ? v.trim() : undefined);
  const base = {
    id,
    title: d.title.trim() || "제목 없는 행사",
    date: d.date,
    startTime: isValidTime(d.startTime) ? d.startTime : undefined,
    endTime: isValidTime(d.endTime) && d.endTime > d.startTime ? d.endTime : undefined,
    location: opt(d.location),
    organizer: opt(d.organizer),
    category: d.category,
    target: opt(d.target),
    applyUrl: opt(d.applyUrl),
    summary: opt(d.summary),
    source,
    rawText: rawText || undefined,
    createdAt,
  };
  return { ...base, missingFields: computeMissingFields(base) };
}

// S03 공지 추가 → S04 추출 확인
export function AddNoticeFlow() {
  const router = useRouter();
  const { state, actions } = useAppData();
  const [mode, setMode] = useState<Mode>("text");
  const [source, setSource] = useState<Source>("kakao");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ drafts: Draft[]; engine: ExtractResponse["engine"]; notice?: string; maskedText: string } | null>(null);
  const [addToMy, setAddToMy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ title: string; share?: ShareResult; shareError?: string }[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!state) return <Loading />;

  const canSubmit =
    !loading &&
    ((mode === "text" && text.trim().length >= 5) || (mode === "image" && !!image) || (mode === "link" && /^https?:\/\/\S+/.test(url.trim())));

  async function paste() {
    try {
      const t = await navigator.clipboard.readText();
      if (t) setText(t);
    } catch {
      setError("붙여넣기 권한이 없어요. 입력칸을 길게 눌러 붙여넣어 주세요.");
    }
  }

  function pickImage(file: File | null) {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImage(file);
    setImagePreview(file ? URL.createObjectURL(file) : null);
  }

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const effectiveSource: Source = mode === "link" ? "link" : source;
      let body: Record<string, unknown>;
      if (mode === "text") body = { mode, text, source: effectiveSource };
      else if (mode === "link") body = { mode, url: url.trim(), source: effectiveSource };
      else {
        const img = await imageToBase64(image!);
        body = { mode, imageBase64: img.data, mediaType: img.mediaType, source: effectiveSource };
      }
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "정리하지 못했어요.");
      const data = json as ExtractResponse;
      if (data.events.length === 0) {
        throw new Error(data.notice ?? "행사 정보를 찾지 못했어요. 날짜·시간이 들어 있는 공지인지 확인해 주세요.");
      }
      // 업로드 이미지는 추출 후 바로 버립니다
      pickImage(null);
      const canShare = !!state!.profile.departmentCode && !!state!.profile.grade;
      setResult({
        drafts: data.events.map((e, i) => toDraft(e, i, state!.now, state!.profile.grade, canShare)),
        engine: data.engine,
        notice: data.notice,
        maskedText: data.maskedText,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // ── 저장 결과 (공유했을 때) ──
  if (saved) {
    return (
      <div className="pb-10">
        <PageHeader title="저장했어요" backHref="/" backLabel="홈으로" />
        <div className="space-y-3 px-4 pt-4">
          {saved.map((o, i) => (
            <div key={i} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
              <p className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
                <CircleCheck aria-hidden className="size-5 text-emerald-700" />
                {o.title}
              </p>
              <p className="mt-1.5 text-sm text-slate-700">
                {o.shareError
                  ? `내 기기에는 저장했지만 공유하지 못했어요: ${o.shareError}`
                  : !o.share
                    ? "내 기기에 저장했어요."
                    : o.share.merged
                      ? `같은 학과 학생이 이미 등록한 행사와 합쳤어요 · ${o.share.registrantCount}명이 등록했어요.`
                      : o.share.urgentSent
                        ? `우리 학과에 공유하고, 촉박한 당일 행사라 ${o.share.recipients}명에게 바로 알렸어요.`
                        : o.share.urgentLimited
                          ? "우리 학과에 공유했어요. 오늘 학과 긴급 알림이 3건을 넘어 알림 없이 피드에만 올렸어요."
                          : "우리 학과 피드에 공유했어요."}
              </p>
            </div>
          ))}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <button type="button" className={secondaryButtonClass} onClick={() => router.push("/")}>
              홈으로
            </button>
            <button type="button" className={primaryButtonClass} onClick={() => router.push(addToMy ? "/my" : "/")}>
              {addToMy ? "내 일정 보기" : "확인"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── S04 추출 확인 ──
  if (result) {
    const now = state.now;
    const createdAt = now.toISOString();
    const effectiveSource: Source = mode === "link" ? "link" : source;
    const included = result.drafts.filter((d) => d.include);
    const blocking = included.some((d) => !isValidDate(d.date) || !d.title.trim());
    const update = (key: string, patch: Partial<Draft>) =>
      setResult({
        ...result,
        drafts: result.drafts.map((d) => {
          if (d.key !== key) return d;
          const next = { ...d, ...patch };
          if (!("date" in patch) && !("startTime" in patch)) return next;
          // 날짜·시간을 고치면 촉박함을 다시 판단합니다 (촉박해지면 공유를 켜고, 촉박하지 않게 되면 자동으로 켰던 공유를 끔)
          const urgent =
            isValidDate(next.date) && defaultShareOn({ date: next.date, startTime: isValidTime(next.startTime) ? next.startTime : null }, now);
          if (urgent === d.urgent) return next;
          const canShare = !!state.profile.departmentCode && !!state.profile.grade;
          return { ...next, urgent, share: urgent ? canShare : d.share && !d.urgent };
        }),
      });

    return (
      <div className="pb-28">
        <PageHeader title="내용 확인" backHref="/" backLabel="홈으로" />
        <div className="space-y-4 px-4 pt-4">
          <p
            className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm ${
              result.engine === "ai" ? "bg-indigo-50 text-indigo-900" : "bg-amber-50 text-amber-900"
            }`}
          >
            {result.engine === "ai" ? (
              <Sparkles aria-hidden className="mt-0.5 size-4 shrink-0" />
            ) : (
              <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            )}
            <span>
              {result.notice ??
                (result.drafts.length > 1
                  ? `공지에서 행사 ${result.drafts.length}개를 찾았어요. 저장 전에 확인해 주세요.`
                  : "AI가 정리했어요. 저장 전에 확인해 주세요.")}
            </span>
          </p>

          {result.drafts.map((d, i) => {
            const preview = draftToEvent(d, effectiveSource, "", createdAt, `preview-${d.key}`);
            const dateOk = isValidDate(d.date);
            const duplicate = dateOk ? findDuplicate(preview, state.events) : undefined;
            const ctx = { interestCategories: state.interests, addedEventIds: addToMy ? [preview.id] : [], settings: state.settings };
            const isTarget = isNotifyTarget(preview, ctx);
            const targets = state.events.filter((e) =>
              isNotifyTarget(e, { ...ctx, addedEventIds: state.addedIds }),
            );
            const low = (f: keyof Draft["confidence"]) => d.confidence[f] === "low";
            return (
              <article
                key={d.key}
                aria-label={`행사 ${i + 1}`}
                className={`space-y-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200 ${d.include ? "" : "opacity-60"}`}
              >
                {result.drafts.length > 1 && (
                  <label className="flex min-h-11 items-center gap-2 text-[15px] font-semibold text-slate-900">
                    <input
                      type="checkbox"
                      className="size-5 accent-indigo-600"
                      checked={d.include}
                      onChange={(e) => update(d.key, { include: e.target.checked })}
                    />
                    행사 {i + 1} 저장하기
                  </label>
                )}

                <Field label="제목">
                  <input className={inputClass} value={d.title} onChange={(e) => update(d.key, { title: e.target.value })} />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label={dateOk ? "날짜" : "날짜 · 확인 필요"} warn={!dateOk || low("date")}>
                    <input
                      type="date"
                      className={`${inputClass} ${!dateOk ? "border-amber-500 bg-amber-50" : ""}`}
                      value={d.date}
                      onChange={(e) => update(d.key, { date: e.target.value })}
                    />
                  </Field>
                  <Field label="카테고리">
                    <select
                      className={inputClass}
                      value={d.category}
                      onChange={(e) => update(d.key, { category: e.target.value as Category })}
                    >
                      {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
                        <option key={c} value={c}>
                          {CATEGORY_LABEL[c]}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={d.startTime ? "시작" : "시작 · 확인 필요"} warn={!d.startTime || low("startTime")}>
                    <input
                      type="time"
                      step={300}
                      className={`${inputClass} ${!d.startTime ? "border-amber-500 bg-amber-50" : ""}`}
                      value={d.startTime}
                      onChange={(e) => update(d.key, { startTime: e.target.value })}
                    />
                  </Field>
                  <Field label="끝 (선택)">
                    <input
                      type="time"
                      step={300}
                      className={inputClass}
                      value={d.endTime}
                      onChange={(e) => update(d.key, { endTime: e.target.value })}
                    />
                  </Field>
                </div>
                <Field label={d.location ? "장소" : "장소 · 확인 필요"} warn={!d.location || low("location")}>
                  <input
                    className={`${inputClass} ${!d.location ? "border-amber-500 bg-amber-50" : ""}`}
                    value={d.location}
                    placeholder="공지에 장소가 없어요. 알면 입력해 주세요."
                    onChange={(e) => update(d.key, { location: e.target.value })}
                  />
                </Field>
                <details className="text-sm">
                  <summary className="min-h-11 cursor-pointer py-2.5 font-semibold text-slate-700">주최·신청 링크 등 더 보기</summary>
                  <div className="space-y-3 pt-1">
                    <Field label="주최">
                      <input className={inputClass} value={d.organizer} onChange={(e) => update(d.key, { organizer: e.target.value })} />
                    </Field>
                    <Field label="대상">
                      <input className={inputClass} value={d.target} onChange={(e) => update(d.key, { target: e.target.value })} />
                    </Field>
                    <Field label="신청 링크">
                      <input type="url" className={inputClass} value={d.applyUrl} onChange={(e) => update(d.key, { applyUrl: e.target.value })} />
                    </Field>
                  </div>
                </details>

                {!d.startTime && (
                  <p className="flex items-start gap-1.5 text-sm font-medium text-amber-900">
                    <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                    시작 시각이 없으면 알림을 예약할 수 없어요. 시간을 입력해 주세요.
                  </p>
                )}
                {duplicate && (
                  <p className="flex items-start gap-1.5 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-900">
                    <Copy aria-hidden className="mt-0.5 size-4 shrink-0" />
                    이미 있는 행사 같아요: {formatDateLabel(duplicate.date)} {duplicate.startTime ?? ""} {duplicate.title}
                  </p>
                )}

                {dateOk && (
                  <div className="border-t border-slate-100 pt-1">
                    <p className="mt-2 text-xs font-bold text-slate-500">알림 미리보기</p>
                    <FitLine fit={compareWithTimetable(preview, state.timetable)} startTime={preview.startTime} />
                    <NotifyLine
                      eventId={preview.id}
                      notifications={planForEvent(preview, targets, state.timetable, state.settings, now)}
                      isTarget={isTarget}
                      fit={compareWithTimetable(preview, state.timetable)}
                      leadMinutes={state.settings.beforeEvent.leadMinutes}
                      untargetedPrefix="관심 분야가 아니라서, 내 일정에 담으면 "
                    />
                  </div>
                )}

                <ShareControl
                  draft={d}
                  canShare={!!state.profile.departmentCode && !!state.profile.grade}
                  myGrade={state.profile.grade}
                  onChange={(patch) => update(d.key, patch)}
                />
              </article>
            );
          })}

          <div className="rounded-2xl bg-white px-4 ring-1 ring-slate-200">
            <Switch
              label="내 일정에 바로 담기"
              description="담으면 관심 분야가 아니어도 알림을 받아요."
              checked={addToMy}
              onChange={setAddToMy}
            />
          </div>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-[430px] gap-2 border-t border-slate-200 bg-white px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <button type="button" className={`${secondaryButtonClass} shrink-0`} onClick={() => setResult(null)}>
            다시 입력
          </button>
          <button
            type="button"
            disabled={included.length === 0 || blocking || saving}
            className={primaryButtonClass}
            onClick={async () => {
              setSaving(true);
              const pairs = included.map((d) => ({
                d,
                ev: draftToEvent(d, effectiveSource, result.maskedText, createdAt, crypto.randomUUID()),
              }));
              const outcomes: { title: string; share?: ShareResult; shareError?: string }[] = [];
              // 공유는 카드 필드만 서버에 올립니다 (원문·등록자 정보 없음)
              for (const { d, ev } of pairs) {
                if (!d.share) {
                  outcomes.push({ title: ev.title });
                  continue;
                }
                try {
                  const share = await shareEvent(
                    {
                      title: ev.title,
                      date: ev.date,
                      startTime: ev.startTime ?? null,
                      endTime: ev.endTime ?? null,
                      location: ev.location ?? null,
                      category: ev.category,
                      applyUrl: ev.applyUrl ?? null,
                    },
                    d.scope,
                    d.grades,
                  );
                  ev.sharedEventId = share.sharedEventId;
                  outcomes.push({ title: ev.title, share });
                } catch (e) {
                  outcomes.push({ title: ev.title, shareError: (e as Error).message });
                }
              }
              actions.addEvents(
                pairs.map((p) => p.ev),
                addToMy,
              );
              setSaving(false);
              if (outcomes.some((o) => o.share || o.shareError)) setSaved(outcomes);
              else router.push(addToMy ? "/my" : "/");
            }}
          >
            {saving
              ? "저장하는 중…"
              : blocking
                ? "날짜를 입력해 주세요"
                : `${included.length > 1 ? `${included.length}개 ` : ""}저장`}
          </button>
        </div>
      </div>
    );
  }

  // ── S03 공지 추가 ──
  return (
    <div className="pb-28">
      <PageHeader title="공지 추가" backHref="/" backLabel="홈으로" />
      <div className="space-y-4 px-4 pt-4">
        <Segmented
          label="입력 방식"
          value={mode}
          options={MODE_OPTIONS}
          onChange={(m) => {
            setMode(m);
            setError(null);
            if (m === "image" && source === "kakao") setSource("offline");
          }}
        />

        {mode !== "link" && (
          <div>
            <p className="mb-1.5 text-sm font-semibold text-slate-700">어디서 본 공지예요?</p>
            <div className="flex flex-wrap gap-2">
              {SOURCE_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={source === o.value}
                  onClick={() => setSource(o.value)}
                  className={`min-h-11 rounded-full px-4 text-sm font-semibold ring-1 ${
                    source === o.value ? "bg-indigo-600 text-white ring-indigo-600" : "bg-white text-slate-700 ring-slate-300"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="flex items-start gap-2 rounded-xl bg-slate-100 px-3 py-2.5 text-sm text-slate-700">
          <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-slate-600" />
          <span>
            공지 내용만 붙여넣어 주세요. 개인 대화는 포함하지 마세요.
            <br />
            전화번호·이메일·학번은 가린 뒤 정리해요.
          </span>
        </p>

        {mode === "text" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="notice-text" className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                <Type aria-hidden className="size-4" />
                공지 내용
              </label>
              <button
                type="button"
                onClick={paste}
                className="flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-semibold text-indigo-700 active:bg-indigo-50"
              >
                <ClipboardPaste aria-hidden className="size-4" />
                붙여넣기
              </button>
            </div>
            <textarea
              id="notice-text"
              rows={10}
              className={`${inputClass} resize-y leading-relaxed`}
              placeholder={"예)\n[공지] 졸업생 초청 진로 특강\n일시: 11월 20일(금) 오후 5시~7시\n장소: 인문관 301호"}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
        )}

        {mode === "image" && (
          <div className="space-y-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="sr-only"
              aria-label="포스터·캡처 이미지 선택"
              onChange={(e) => pickImage(e.target.files?.[0] ?? null)}
            />
            {imagePreview ? (
              <div className="relative overflow-hidden rounded-2xl ring-1 ring-slate-200">
                {/* eslint-disable-next-line @next/next/no-img-element -- 로컬 미리보기(blob URL) */}
                <img src={imagePreview} alt="선택한 공지 이미지 미리보기" className="max-h-80 w-full bg-slate-100 object-contain" />
                <button
                  type="button"
                  onClick={() => pickImage(null)}
                  aria-label="이미지 지우기"
                  className="absolute top-2 right-2 grid size-11 place-items-center rounded-full bg-slate-900/70 text-white"
                >
                  <X aria-hidden className="size-5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex min-h-40 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-white text-slate-700 active:bg-slate-50"
              >
                <ImagePlus aria-hidden className="size-8" />
                <span className="text-[15px] font-semibold">포스터 찍기 · 캡처 고르기</span>
              </button>
            )}
            <p className="text-sm text-slate-600">이미지는 정리한 뒤 저장하지 않아요. AI 키가 있어야 이미지를 읽을 수 있어요.</p>
          </div>
        )}

        {mode === "link" && (
          <div className="space-y-2">
            <label htmlFor="notice-url" className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
              <Link2 aria-hidden className="size-4" />
              공지 링크
            </label>
            <input
              id="notice-url"
              type="url"
              inputMode="url"
              className={inputClass}
              placeholder="https://"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <p className="text-sm text-slate-600">로그인이 필요한 페이지(에브리타임 등)는 열 수 없어요. 그럴 땐 내용을 복사해 텍스트로 넣어 주세요.</p>
          </div>
        )}

        {error && (
          <p role="alert" className="flex items-start gap-1.5 rounded-xl bg-orange-50 px-3 py-2.5 text-sm font-medium text-orange-900">
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[430px] border-t border-slate-200 bg-white px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <button type="button" disabled={!canSubmit} onClick={submit} className={primaryButtonClass}>
          {loading ? (
            <>
              <Loader2 aria-hidden className="size-5 animate-spin" />
              정리하는 중이에요…
            </>
          ) : (
            <>
              <Sparkles aria-hidden className="size-5" />
              정리하기
            </>
          )}
        </button>
      </div>
    </div>
  );
}

const SCOPE_OPTIONS = [
  { value: "grade", label: "내 학년" },
  { value: "department", label: "학과 전체" },
] as const;

/** "우리 학과에 공유" 스위치와 범위 (FR-11). 촉박한 행사는 자동으로 켜지지만 저장 전에 끌 수 있어요 */
function ShareControl({
  draft,
  canShare,
  myGrade,
  onChange,
}: {
  draft: Draft;
  canShare: boolean;
  myGrade: Grade | null;
  onChange: (patch: Partial<Draft>) => void;
}) {
  return (
    <div className="border-t border-slate-100 pt-1">
      <Switch
        label="우리 학과에 공유"
        description={
          !canShare
            ? "설정에서 학과·학년을 고르면 같은 학과 학생에게 공유할 수 있어요."
            : draft.urgent
              ? "오늘 6시간 안에 시작하는 행사라 공유를 켜 두었어요. 같은 학과 학생에게 바로 알림이 가요. 원하지 않으면 끄세요."
              : "켜면 같은 학과 피드에 올라가요. 카드 정보(제목·날짜·시간·장소·분야·신청 링크)만 공유돼요."
        }
        checked={draft.share}
        onChange={(share) => onChange({ share })}
        disabled={!canShare}
      />
      {draft.urgent && canShare && (
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-amber-900">
          <Zap aria-hidden className="size-3.5" />
          촉박한 당일 행사
        </p>
      )}
      {draft.share && canShare && (
        <div className="pb-2">
          <Segmented
            label="공유 범위"
            value={draft.scope}
            options={SCOPE_OPTIONS}
            onChange={(scope) => onChange({ scope, grades: scope === "grade" ? (draft.grades.length ? draft.grades : myGrade ? [myGrade] : []) : [] })}
          />
          <p className="mt-1.5 text-xs text-slate-600">
            {draft.scope === "department"
              ? "같은 학과 모든 학년에게 보여요."
              : `같은 학과 ${draft.grades.length ? draft.grades.join("·") : myGrade}학년에게 보여요.`}
          </p>
        </div>
      )}
    </div>
  );
}
