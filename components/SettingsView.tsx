"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronRight, FlaskConical, RotateCcw } from "lucide-react";
import { DepartmentPicker } from "./DepartmentPicker";
import { PushSection, TestTools } from "./SettingsTools";
import { BottomSheet, Loading, PageHeader, Segmented, Switch, inputClass, secondaryButtonClass } from "./ui";
import { findDepartment } from "@/config/departments";
import { formatShortDate, fromLocalInputValue, toLocalInputValue } from "@/lib/dates";
import { useAppData, type Profile } from "@/lib/useAppData";
import { CATEGORY_LABEL, type Category, type NotifySettings } from "@/lib/types";

const LEAD_OPTIONS = [
  { value: 30, label: "30분 전" },
  { value: 60, label: "1시간 전" },
  { value: 90, label: "1시간 30분 전" },
] as const;

const GRADE_OPTIONS = [
  { value: 1, label: "1학년" },
  { value: 2, label: "2학년" },
  { value: 3, label: "3학년" },
  { value: 4, label: "4학년" },
] as const;

function Section({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${title}-h`} className="scroll-mt-16">
      <h2 id={`${title}-h`} className="mb-2 px-1 text-sm font-bold text-slate-600">
        {title}
      </h2>
      <div className="divide-y divide-slate-100 rounded-2xl bg-white px-4 ring-1 ring-slate-200">{children}</div>
    </section>
  );
}

// S09 설정
export function SettingsView() {
  const { state, actions } = useAppData();
  const [deptOpen, setDeptOpen] = useState(false);
  const [testValue, setTestValue] = useState<string | null>(null);

  if (!state) return <Loading />;
  const { settings, interests, profile, timetable } = state;
  const dept = findDepartment(profile.departmentCode);
  const setNotify = (patch: Partial<NotifySettings>) => actions.setSettings({ ...settings, ...patch });
  const toggleInterest = (c: Category) =>
    actions.setInterests(interests.includes(c) ? interests.filter((x) => x !== c) : [...interests, c]);

  return (
    <div>
      <PageHeader title="설정" />
      <div className="space-y-6 px-4 pt-4 pb-6">
        <Section title="내 정보">
          <button
            type="button"
            onClick={() => setDeptOpen(true)}
            className="flex min-h-14 w-full items-center gap-2 py-2 text-left"
          >
            <span className="flex-1">
              <span className="block text-[15px] font-semibold text-slate-900">학과</span>
              <span className="block text-sm text-slate-600">{dept ? `${dept.name} · ${dept.college}` : "선택하지 않았어요"}</span>
            </span>
            <ChevronRight aria-hidden className="size-5 text-slate-500" />
          </button>
          <div className="py-3">
            <p className="mb-2 text-[15px] font-semibold text-slate-900">학년</p>
            <Segmented
              label="학년"
              value={profile.grade ?? 0}
              options={GRADE_OPTIONS}
              onChange={(grade) => actions.setProfile({ ...profile, grade: grade as Profile["grade"] })}
            />
          </div>
          <p className="py-3 text-sm text-slate-600">
            학과·학년은 같은 학과 학생과 행사를 나눌 때 써요. 인증은 하지 않고 언제든 바꿀 수 있어요.
          </p>
        </Section>

        <Section title="수업 시간표">
          <Link href="/timetable" className="flex min-h-14 items-center gap-2 py-2">
            <span className="flex-1">
              <span className="block text-[15px] font-semibold text-slate-900">시간표 편집</span>
              <span className="block text-sm text-slate-600">
                {timetable.classes.length > 0
                  ? `수업 ${timetable.classes.length}개 · 학기 ${formatShortDate(timetable.semesterStart)}~${formatShortDate(timetable.semesterEnd)}`
                  : "아직 등록하지 않았어요"}
              </span>
            </span>
            <ChevronRight aria-hidden className="size-5 text-slate-500" />
          </Link>
        </Section>

        <Section title="알림">
          <Switch
            label="행사 전 알림"
            description="모든 관심 행사를 당일 시작 전에 알려 드려요. 시간표가 없어도 동작해요."
            checked={settings.beforeEvent.enabled}
            onChange={(enabled) => setNotify({ beforeEvent: { ...settings.beforeEvent, enabled } })}
          />
          {settings.beforeEvent.enabled && (
            <div className="py-3">
              <p className="mb-2 text-sm font-semibold text-slate-700">얼마 전에 알릴까요?</p>
              <Segmented
                label="행사 전 알림 시점"
                value={settings.beforeEvent.leadMinutes}
                options={LEAD_OPTIONS}
                onChange={(leadMinutes) => setNotify({ beforeEvent: { ...settings.beforeEvent, leadMinutes } })}
              />
            </div>
          )}
          <Switch
            label="귀가 시간 알림"
            description="마지막 수업이 끝날 때, 그 뒤에 열리는 행사를 하루 1건으로 묶어 알려 드려요. 기숙사생이라면 꺼도 돼요."
            checked={settings.atGoHome.enabled}
            onChange={(enabled) => setNotify({ atGoHome: { enabled } })}
          />
          <Switch
            label="우리 학과 긴급 알림"
            description={
              dept && profile.grade
                ? "같은 학과·학년 학생이 오늘 6시간 안에 시작하는 행사를 등록하면 바로 알려 드려요."
                : "학과·학년을 고르면 받을 수 있어요."
            }
            checked={settings.deptUrgent.enabled}
            onChange={(enabled) => setNotify({ deptUrgent: { enabled } })}
            disabled={!dept || !profile.grade}
          />
          <Link href="/notifications" className="flex min-h-14 items-center gap-2 py-2">
            <span className="flex-1 text-[15px] font-semibold text-slate-900">알림센터</span>
            <ChevronRight aria-hidden className="size-5 text-slate-500" />
          </Link>
        </Section>

        <Section title="이 기기에서 푸시 받기">
          <PushSection />
        </Section>

        <section aria-labelledby="interest-h">
          <h2 id="interest-h" className="mb-1 px-1 text-sm font-bold text-slate-600">
            관심 분야
          </h2>
          <p className="mb-2 px-1 text-sm text-slate-600">
            고른 분야만 홈에 보이고 알림을 받아요. 내 일정에 담은 행사는 분야와 관계없이 알려 드려요.
          </p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => {
              const on = interests.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleInterest(c)}
                  className={`flex min-h-11 items-center gap-1 rounded-full px-4 text-sm font-semibold ring-1 ${
                    on ? "bg-indigo-600 text-white ring-indigo-600" : "bg-white text-slate-700 ring-slate-300"
                  }`}
                >
                  {on && <Check aria-hidden className="size-4" />}
                  {CATEGORY_LABEL[c]}
                </button>
              );
            })}
          </div>
        </section>

        <Section id="test-mode" title="테스트 모드 (데모용)">
          <TestTools hasDept={!!dept && !!profile.grade} />
          <div className="py-3">
            <p className="flex items-center gap-1.5 text-[15px] font-semibold text-slate-900">
              <FlaskConical aria-hidden className="size-4 text-violet-700" />
              현재 시각 바꾸기
            </p>
            <p className="mt-0.5 mb-2 text-sm text-slate-600">
              앱이 이 시각을 &lsquo;지금&rsquo;으로 보고 알림 판단 결과를 보여 줘요.
              {state.testNowActive && <strong className="text-violet-800"> 지금 테스트 시각을 쓰고 있어요.</strong>}
            </p>
            <div className="flex gap-2">
              <input
                type="datetime-local"
                aria-label="테스트 시각"
                className={inputClass}
                value={testValue ?? toLocalInputValue(state.now)}
                onChange={(e) => setTestValue(e.target.value)}
              />
              <button
                type="button"
                className={`${secondaryButtonClass} shrink-0`}
                onClick={() => {
                  const at = fromLocalInputValue(testValue ?? toLocalInputValue(state.now));
                  if (at) actions.setTestNow(at);
                  setTestValue(null);
                }}
              >
                적용
              </button>
            </div>
            {state.testNowActive && (
              <button
                type="button"
                onClick={() => {
                  actions.setTestNow(null);
                  setTestValue(null);
                }}
                className="mt-2 min-h-11 text-sm font-semibold text-violet-800 underline underline-offset-2"
              >
                실제 시각으로 돌아가기
              </button>
            )}
          </div>
          {state.dismissedIds.length > 0 && (
            <button type="button" onClick={actions.restoreDismissed} className="flex min-h-14 w-full items-center py-2 text-left">
              <span className="flex-1 text-[15px] font-semibold text-slate-900">
                &lsquo;관심 없음&rsquo;으로 숨긴 행사 {state.dismissedIds.length}건 되돌리기
              </span>
            </button>
          )}
          <Link href="/onboarding" className="flex min-h-14 items-center gap-2 py-2">
            <span className="flex-1 text-[15px] font-semibold text-slate-900">처음 설정 다시 하기</span>
            <ChevronRight aria-hidden className="size-5 text-slate-500" />
          </Link>
          <div className="py-3">
            <button
              type="button"
              onClick={() => {
                if (window.confirm("시간표·행사·설정을 모두 지우고 데모 데이터로 다시 시작할까요?")) actions.resetDemo();
              }}
              className="flex min-h-11 items-center gap-1.5 text-sm font-semibold text-red-700"
            >
              <RotateCcw aria-hidden className="size-4" />
              데모 데이터로 초기화
            </button>
          </div>
        </Section>
      </div>

      <BottomSheet open={deptOpen} title="학과 선택" onClose={() => setDeptOpen(false)}>
        <DepartmentPicker
          autoFocus
          selected={profile.departmentCode}
          onSelect={(code) => {
            actions.setProfile({ ...profile, departmentCode: code });
            setDeptOpen(false);
          }}
        />
      </BottomSheet>
    </div>
  );
}
