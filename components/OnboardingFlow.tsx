"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellOff, BellRing, Bus, Check, ChevronLeft, Info, Sparkles } from "lucide-react";
import { DepartmentPicker } from "./DepartmentPicker";
import { TimetableCapture } from "./TimetableCapture";
import { ClassGridEditor } from "./TimetableEditor";
import { Field, Loading, Segmented, inputClass, primaryButtonClass, secondaryButtonClass } from "./ui";
import { findDepartment } from "@/config/departments";
import { isValidDate } from "@/lib/dates";
import { EXAMPLE_TIMETABLE, useAppData, type Profile } from "@/lib/useAppData";
import { CATEGORY_LABEL, type Category } from "@/lib/types";

const STEPS = ["학과·학년", "시간표", "관심 분야", "알림"] as const;

const GRADE_OPTIONS = [
  { value: 1, label: "1학년" },
  { value: 2, label: "2학년" },
  { value: 3, label: "3학년" },
  { value: 4, label: "4학년" },
] as const;

type Permission = NotificationPermission | "unsupported";

function readPermission(): Permission {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

// S01 온보딩: ① 학과·학년 → ② 시간표 → ③ 관심 분야 → ④ 알림 권한 (FR-8)
export function OnboardingFlow() {
  const router = useRouter();
  const { state, actions } = useAppData();
  const [step, setStep] = useState(0);
  const [skipDept, setSkipDept] = useState(false);
  const [permission, setPermission] = useState<Permission>("default");

  useEffect(() => {
    setPermission(readPermission());
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

  if (!state) return <Loading />;
  const { profile, timetable, interests } = state;
  const dept = findDepartment(profile.departmentCode);
  const hasProfile = !!dept && !!profile.grade;
  const hasTimetable = timetable.classes.length > 0;

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const finish = () => {
    actions.setOnboarded(true);
    router.replace("/");
  };

  async function requestPermission() {
    if (readPermission() === "unsupported") return setPermission("unsupported");
    try {
      setPermission(await Notification.requestPermission());
    } catch {
      setPermission(readPermission());
    }
  }

  // 단계별 하단 버튼
  let cta: { label: string; onClick: () => void; disabled?: boolean };
  if (step === 0) {
    cta = skipDept
      ? { label: "학과 없이 계속", onClick: next }
      : { label: "다음", onClick: next, disabled: !hasProfile };
  } else if (step === 1) {
    cta = { label: hasTimetable ? "다음" : "시간표 없이 계속", onClick: next };
  } else if (step === 2) {
    cta = { label: interests.length > 0 ? "다음" : "하나 이상 골라 주세요", onClick: next, disabled: interests.length === 0 };
  } else {
    cta = { label: "핑캠퍼스 시작하기", onClick: finish };
  }

  return (
    <div className="pb-28">
      <header className="sticky top-0 z-10 bg-slate-50/95 px-4 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-3 backdrop-blur">
        <div className="flex min-h-11 items-center gap-1">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              aria-label="이전 단계"
              className="-ml-2 grid size-11 place-items-center rounded-full text-slate-700 active:bg-slate-200"
            >
              <ChevronLeft aria-hidden className="size-6" />
            </button>
          ) : (
            <span className="text-base font-extrabold text-indigo-700">핑캠퍼스</span>
          )}
          <span className="ml-auto text-sm font-semibold text-slate-600">
            {step + 1} / {STEPS.length} · {STEPS[step]}
          </span>
        </div>
        <ol className="mt-2 grid grid-cols-4 gap-1.5" aria-label="진행 단계">
          {STEPS.map((label, i) => (
            <li
              key={label}
              aria-current={i === step ? "step" : undefined}
              className={`h-1.5 rounded-full ${i <= step ? "bg-indigo-600" : "bg-slate-300"}`}
            >
              <span className="sr-only">
                {label} {i < step ? "완료" : i === step ? "진행 중" : ""}
              </span>
            </li>
          ))}
        </ol>
      </header>

      <div className="space-y-4 px-4 pt-3">
        {step === 0 && (
          <>
            <StepTitle
              title="학과와 학년을 골라 주세요"
              body="같은 학과·학년 학생이 등록한 촉박한 당일 행사를 바로 알려 드릴 때 써요. 인증은 하지 않고, 설정에서 언제든 바꿀 수 있어요."
            />
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-700">학년</p>
              <Segmented
                label="학년"
                value={profile.grade ?? 0}
                options={GRADE_OPTIONS}
                onChange={(grade) => {
                  setSkipDept(false);
                  actions.setProfile({ ...profile, grade: grade as Profile["grade"] });
                }}
              />
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-700">
                학과 {dept && <span className="font-bold text-indigo-700">· {dept.name}</span>}
              </p>
              <div className="rounded-2xl bg-white p-3 ring-1 ring-slate-200 [&_ul]:max-h-[38dvh]">
                <DepartmentPicker
                  selected={profile.departmentCode}
                  onSelect={(code) => {
                    setSkipDept(false);
                    actions.setProfile({ ...profile, departmentCode: code });
                  }}
                />
              </div>
            </div>
            {skipDept ? (
              <Notice>
                학과·학년을 건너뛰면 <strong>우리 학과 공유·긴급 알림</strong>을 쓸 수 없어요. 설정에서 언제든 고를 수 있어요.
              </Notice>
            ) : (
              !hasProfile && (
                <button
                  type="button"
                  onClick={() => setSkipDept(true)}
                  className="min-h-11 w-full text-sm font-semibold text-slate-600 underline underline-offset-2"
                >
                  나중에 고를게요
                </button>
              )
            )}
          </>
        )}

        {step === 1 && (
          <>
            <StepTitle
              title="수업 시간표를 등록해 주세요"
              body="그날 마지막 수업이 끝나는 시각을 귀가 시간으로 계산해서, 그 뒤에 열리는 행사를 버스 타기 전에 한 번 더 알려 드려요."
            />
            {!hasTimetable && (
              <button
                type="button"
                onClick={() => actions.setTimetable({ ...EXAMPLE_TIMETABLE, exceptions: [] })}
                className={`${secondaryButtonClass} w-full`}
              >
                <Sparkles aria-hidden className="size-4 text-indigo-600" />
                예시 시간표 불러오기 (데모)
              </button>
            )}
            <TimetableCapture timetable={timetable} onChange={actions.setTimetable} />
            <div className="-mx-1">
              <ClassGridEditor timetable={timetable} onChange={actions.setTimetable} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="학기 시작">
                <input
                  type="date"
                  className={inputClass}
                  value={timetable.semesterStart}
                  onChange={(e) =>
                    isValidDate(e.target.value) && actions.setTimetable({ ...timetable, semesterStart: e.target.value })
                  }
                />
              </Field>
              <Field label="학기 끝">
                <input
                  type="date"
                  className={inputClass}
                  value={timetable.semesterEnd}
                  onChange={(e) =>
                    isValidDate(e.target.value) && actions.setTimetable({ ...timetable, semesterEnd: e.target.value })
                  }
                />
              </Field>
            </div>
            {!hasTimetable && (
              <Notice>
                시간표 없이 시작하면 <strong>행사 1시간 전 알림</strong>만 받아요. 수업이 끝날 때 받는 귀가 시간 알림은 시간표를 등록한 뒤에 받을 수 있어요.
              </Notice>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <StepTitle
              title="어떤 행사가 궁금하세요?"
              body="고른 분야만 홈에 보이고 알림을 받아요. 나머지는 숨겨 두었다가 필요할 때 펼쳐 볼 수 있어요."
            />
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => {
                const on = interests.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={on}
                    onClick={() => actions.setInterests(on ? interests.filter((x) => x !== c) : [...interests, c])}
                    className={`flex min-h-14 items-center justify-center gap-1.5 rounded-xl text-[15px] font-semibold ring-1 ${
                      on ? "bg-indigo-600 text-white ring-indigo-600" : "bg-white text-slate-700 ring-slate-300"
                    }`}
                  >
                    {on && <Check aria-hidden className="size-4" />}
                    {CATEGORY_LABEL[c]}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <StepTitle title="알림을 켜 주세요" body="행사를 놓치지 않도록 딱 필요한 순간에만 알려 드려요." />
            <ul className="space-y-2">
              <AlertExample
                icon={<Bell aria-hidden className="size-5" />}
                title="행사 1시간 전"
                body="관심 행사와 내 일정에 담은 행사를 당일 시작 1시간 전에 알려 드려요."
              />
              <AlertExample
                icon={<Bus aria-hidden className="size-5" />}
                title="귀가 시간"
                body={
                  hasTimetable
                    ? "마지막 수업이 끝날 때, 그 뒤에 열리는 행사를 하루 1건으로 묶어 알려 드려요."
                    : "시간표를 등록하면 마지막 수업이 끝날 때도 알려 드려요."
                }
                muted={!hasTimetable}
              />
            </ul>

            {permission === "granted" ? (
              <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-3 text-sm font-semibold text-emerald-800">
                <BellRing aria-hidden className="size-5" />
                알림이 켜졌어요.
              </p>
            ) : permission === "denied" ? (
              <Notice icon={<BellOff aria-hidden className="mt-0.5 size-4 shrink-0" />}>
                알림이 차단되어 있어요. 브라우저 설정에서 핑캠퍼스 알림을 허용하면 받을 수 있어요.
              </Notice>
            ) : permission === "unsupported" ? (
              <Notice icon={<BellOff aria-hidden className="mt-0.5 size-4 shrink-0" />}>
                이 브라우저에서는 알림을 받을 수 없어요. iPhone은 Safari에서 &lsquo;홈 화면에 추가&rsquo;한 뒤 열면 알림을 켤 수 있어요.
              </Notice>
            ) : (
              <button type="button" onClick={requestPermission} className={primaryButtonClass}>
                <Bell aria-hidden className="size-5" />
                알림 허용하기
              </button>
            )}
            <p className="text-sm text-slate-600">알림 시점과 종류는 설정에서 언제든 바꿀 수 있어요.</p>
          </>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[430px] border-t border-slate-200 bg-white px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <button type="button" onClick={cta.onClick} disabled={cta.disabled} className={primaryButtonClass}>
          {cta.label}
        </button>
      </div>
    </div>
  );
}

function StepTitle({ title, body }: { title: string; body: string }) {
  return (
    <div className="pt-2">
      <h1 className="text-[22px] leading-snug font-bold tracking-tight text-slate-900">{title}</h1>
      <p className="mt-1.5 text-[15px] text-slate-600">{body}</p>
    </div>
  );
}

function Notice({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
      {icon ?? <Info aria-hidden className="mt-0.5 size-4 shrink-0" />}
      <span>{children}</span>
    </p>
  );
}

function AlertExample({
  icon,
  title,
  body,
  muted,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  muted?: boolean;
}) {
  return (
    <li className={`flex gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200 ${muted ? "opacity-70" : ""}`}>
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-indigo-50 text-indigo-700">{icon}</span>
      <span>
        <span className="block text-[15px] font-semibold text-slate-900">{title}</span>
        <span className="block text-sm text-slate-600">{body}</span>
      </span>
    </li>
  );
}
