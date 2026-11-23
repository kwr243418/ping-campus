"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, TriangleAlert } from "lucide-react";
import { WeekGrid, type GridColumn } from "./WeekGrid";
import { BottomSheet, primaryButtonClass, secondaryButtonClass } from "./ui";
import { postJSON } from "@/lib/client/device";
import { imageToBase64 } from "@/lib/client/image";
import { WEEKDAY_LABEL } from "@/lib/dates";
import { findClassConflict } from "@/lib/schedule";
import type { ClassBlock, Timetable, Weekday } from "@/lib/types";

type Recognized = Omit<ClassBlock, "id">;

/** 시간표 캡처 인식 (P1): 업로드 → AI 인식 → 주간 격자로 확인 → 추가 또는 바꾸기 */
export function TimetableCapture({ timetable, onChange }: { timetable: Timetable; onChange: (t: Timetable) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<Recognized[] | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const img = await imageToBase64(file);
      const r = await postJSON<{ classes: Recognized[] }>("/api/extract-timetable", {
        imageBase64: img.data,
        mediaType: img.mediaType,
      });
      if (r.classes.length === 0) setError("캡처에서 수업을 찾지 못했어요. 격자에서 직접 입력해 주세요.");
      else setFound(r.classes);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function apply(mode: "add" | "replace") {
    if (!found) return;
    const base: Timetable = mode === "replace" ? { ...timetable, classes: [], exceptions: [] } : timetable;
    const added: ClassBlock[] = [];
    for (const c of found) {
      const block = { ...c, id: crypto.randomUUID() };
      // 기존 수업과 겹치는 블록은 건너뜁니다
      if (!findClassConflict(block, { ...base, classes: [...base.classes, ...added] })) added.push(block);
    }
    onChange({ ...base, classes: [...base.classes, ...added] });
    setFound(null);
  }

  const columns: GridColumn[] = ([1, 2, 3, 4, 5, 6] as Weekday[]).map((w) => ({
    key: String(w),
    label: WEEKDAY_LABEL[w],
    classes: (found ?? [])
      .filter((c) => c.weekday === w)
      .map((c, i) => ({ id: `${w}-${i}`, start: c.start, end: c.end, title: c.name ?? "수업", sub: c.room })),
    events: [],
  }));

  return (
    <div className="space-y-2">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label="시간표 캡처 이미지 선택"
        onChange={(e) => pick(e.target.files?.[0])}
      />
      <button
        type="button"
        disabled={loading}
        onClick={() => fileRef.current?.click()}
        className={`${secondaryButtonClass} w-full`}
      >
        {loading ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Camera aria-hidden className="size-4" />}
        {loading ? "시간표를 읽는 중이에요…" : "시간표 캡처로 불러오기"}
      </button>
      <p className="text-xs text-slate-600">에브리타임 등 시간표 화면 캡처를 올리면 수업을 읽어 와요. 이미지는 저장하지 않아요.</p>
      {error && (
        <p role="alert" className="flex items-start gap-1.5 rounded-xl bg-orange-50 px-3 py-2.5 text-sm font-medium text-orange-900">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      <BottomSheet open={!!found} title="읽어 온 시간표 확인" onClose={() => setFound(null)}>
        <p className="mb-2 text-sm text-slate-600">
          수업 {found?.length ?? 0}개를 찾았어요. 맞는지 확인한 뒤 저장해 주세요. 저장한 뒤에도 격자에서 고칠 수 있어요.
        </p>
        <WeekGrid columns={columns} />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" className={secondaryButtonClass} onClick={() => apply("add")}>
            기존에 추가
          </button>
          <button type="button" className={primaryButtonClass} onClick={() => apply("replace")}>
            이걸로 바꾸기
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
