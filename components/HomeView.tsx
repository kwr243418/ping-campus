"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, Bus, CalendarClock, ChevronRight, Coffee, FlaskConical, Plus, Users, Zap } from "lucide-react";
import { EventCard } from "./EventCard";
import { Loading } from "./ui";
import { findDepartment } from "@/config/departments";
import { reportShared } from "@/lib/client/share";
import { atSeoul, formatDateLabel, isWithinDays, toTimeString } from "@/lib/dates";
import { isVisibleByInterest, sortByDateTime } from "@/lib/events";
import {
  compareWithTimetable,
  getGoHomeTime,
  isAttendableAfterClass,
  isNotifyTarget,
  planForEvent,
} from "@/lib/schedule";
import { feedItemToEvent } from "@/lib/share";
import { useAppData } from "@/lib/useAppData";
import type { Event } from "@/lib/types";

type Tab = "today" | "week" | "dept";

// S02 홈
export function HomeView() {
  const { state, actions } = useAppData();
  const [tab, setTab] = useState<Tab>("today");
  const [showHidden, setShowHidden] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!state) return <Loading />;
  const { now, today, timetable, allEvents, addedIds, settings, interests, feed, profile } = state;

  const feedById = new Map(feed.map((f) => [`shared-${f.id}`, f]));
  // 공유받은 행사뿐 아니라 내가 공유한 내 행사에도 공유 정보(등록 인원)를 붙입니다
  const sharedInfo = (e: Event) => (e.sharedEventId ? feed.find((f) => f.id === e.sharedEventId) : undefined);
  const targets = allEvents.filter((e) =>
    isNotifyTarget(e, { interestCategories: interests, addedEventIds: addedIds, settings }),
  );
  // 같은 학과에서 공유받은 행사는 관심 분야와 관계없이 보입니다
  const interested = (e: Event) =>
    isVisibleByInterest(e, interests, addedIds) || (!!e.sharedEventId && e.sharedOrigin !== "homepage");
  const visible = (e: Event) => showHidden || interested(e);

  const upcoming = allEvents.filter((e) => e.date >= today);
  const todayAll = upcoming.filter((e) => e.date === today);
  const weekAll = upcoming.filter((e) => isWithinDays(e.date, today, 7));
  const pool = tab === "today" ? todayAll : weekAll;
  const hiddenCount = pool.filter((e) => !interested(e)).length;

  const todayEvents = todayAll.filter(visible).sort(sortByDateTime);
  const weekEvents = weekAll.filter(visible).sort(sortByDateTime);
  const afterClassToday = todayEvents.filter((e) => isAttendableAfterClass(e, timetable, now));
  const otherToday = todayEvents.filter((e) => !afterClassToday.includes(e));

  const deptFeed = feed.filter((f) => f.origin === "student").map(feedItemToEvent).sort(sortByDateTime);
  // ⚡ 오늘 아직 시작 전인, 같은 학과 학생이 등록한 촉박한 행사
  const urgentToday = feed.filter(
    (f) =>
      f.origin === "student" &&
      !f.mine &&
      f.urgentSentAt &&
      f.date === today &&
      f.startTime &&
      atSeoul(f.date, f.startTime) > now,
  );

  const goHomeToday = getGoHomeTime(today, timetable);
  const hasTimetable = timetable.classes.length > 0;
  const dept = findDepartment(profile.departmentCode);

  async function report(id: string) {
    if (!window.confirm("이 행사 정보가 틀렸다고 신고할까요? 두 명 이상 신고하면 피드에서 숨겨져요.")) return;
    try {
      const r = await reportShared(id);
      setMessage(r.hidden ? "신고가 모여 피드에서 숨겼어요." : "신고했어요. 고마워요.");
    } catch (e) {
      setMessage((e as Error).message);
    }
  }

  const renderCard = (e: Event) => (
    <EventCard
      key={e.id}
      event={e}
      today={today}
      fit={compareWithTimetable(e, timetable)}
      notifications={planForEvent(e, targets, timetable, settings, now)}
      isTarget={targets.some((t) => t.id === e.id)}
      added={addedIds.includes(e.id)}
      onToggleAdd={actions.toggleAdded}
      leadMinutes={settings.beforeEvent.leadMinutes}
      shared={sharedInfo(e)}
      onReport={report}
    />
  );

  return (
    <div>
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 px-4 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-extrabold tracking-tight text-indigo-700">핑캠퍼스</h1>
          <div className="flex items-center gap-1">
            <p className="text-sm font-medium text-slate-600">{formatDateLabel(today)}</p>
            <Link
              href="/notifications"
              aria-label={`알림센터${state.unreadCount ? `, 읽지 않은 알림 ${state.unreadCount}개` : ""}`}
              className="relative grid size-11 place-items-center rounded-full text-slate-700 active:bg-slate-200"
            >
              <Bell aria-hidden className="size-5" />
              {state.unreadCount > 0 && (
                <span className="absolute top-1.5 right-1 min-w-5 rounded-full bg-red-600 px-1 text-center text-[11px] leading-5 font-bold text-white">
                  {state.unreadCount > 9 ? "9+" : state.unreadCount}
                </span>
              )}
            </Link>
          </div>
        </div>

        {state.testNowActive && (
          <Link
            href="/settings#test-mode"
            className="mt-1 flex items-center gap-1.5 rounded-lg bg-violet-100 px-3 py-2 text-xs font-semibold text-violet-900"
          >
            <FlaskConical aria-hidden className="size-4" />
            테스트 모드 · 현재 시각 {formatDateLabel(today)} {toTimeString(now)}
          </Link>
        )}

        {/* 오늘의 귀가 시간 */}
        <div className="mt-2 flex items-center gap-3 rounded-xl bg-white px-3.5 py-3 ring-1 ring-slate-200">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-700">
            {goHomeToday ? <Bus aria-hidden className="size-5" /> : <Coffee aria-hidden className="size-5" />}
          </span>
          {goHomeToday ? (
            <div>
              <p className="text-xs font-medium text-slate-600">오늘 귀가 시간 (마지막 수업 종료)</p>
              <p className="text-xl font-bold tracking-tight text-slate-900">{goHomeToday}</p>
            </div>
          ) : (
            <p className="text-[15px] font-semibold text-slate-800">오늘은 수업이 없어요</p>
          )}
        </div>

        <div role="tablist" aria-label="행사 보기" className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-slate-200/70 p-1">
          {(
            [
              ["today", "오늘", todayEvents.length],
              ["week", "이번 주", weekEvents.length],
              ["dept", "우리 학과", deptFeed.length],
            ] as const
          ).map(([key, label, count]) => (
            <button
              key={key}
              role="tab"
              type="button"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`min-h-11 rounded-lg text-sm font-semibold ${
                tab === key ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600"
              }`}
            >
              {label}
              <span className="ml-1 text-xs font-medium opacity-80">{count}</span>
            </button>
          ))}
        </div>
      </header>

      <div className="space-y-6 px-4 pt-4" role="tabpanel">
        {urgentToday.map((f) => (
          <Link
            key={f.id}
            href={`/event/shared-${f.id}`}
            className="flex items-start gap-3 rounded-2xl bg-amber-100 px-4 py-3.5 text-amber-950 ring-1 ring-amber-300"
          >
            <Zap aria-hidden className="mt-0.5 size-5 shrink-0" />
            <span className="flex-1 text-sm">
              <span className="block font-bold">우리 학과 긴급 행사 · 오늘 {f.startTime}</span>
              <span className="block">
                {f.title} · {f.location ?? "장소 확인 필요"}
              </span>
            </span>
            <ChevronRight aria-hidden className="size-5 shrink-0" />
          </Link>
        ))}

        {message && (
          <p role="status" className="rounded-xl bg-slate-800 px-4 py-3 text-sm font-medium text-white">
            {message}
          </p>
        )}

        {!hasTimetable && tab !== "dept" && (
          <Link
            href="/timetable"
            className="flex items-center gap-3 rounded-2xl bg-indigo-50 px-4 py-3.5 text-indigo-900 ring-1 ring-indigo-200"
          >
            <CalendarClock aria-hidden className="size-6 shrink-0" />
            <span className="flex-1 text-sm font-semibold">시간표를 등록하면 수업이 끝날 때도 알려 드려요</span>
            <ChevronRight aria-hidden className="size-5" />
          </Link>
        )}

        {tab === "today" && (
          <>
            <section aria-labelledby="after-class-title">
              <h2 id="after-class-title" className="mb-2 text-[15px] font-bold text-slate-900">
                오늘 수업 끝나고 갈 수 있는 행사
              </h2>
              {afterClassToday.length > 0 ? (
                <div className="space-y-3">{afterClassToday.map(renderCard)}</div>
              ) : (
                <EmptyState text="오늘 수업 후에 열리는 행사가 없어요." />
              )}
            </section>
            {otherToday.length > 0 && (
              <section aria-labelledby="other-today-title">
                <h2 id="other-today-title" className="mb-2 text-[15px] font-bold text-slate-900">
                  그 밖의 오늘 행사
                </h2>
                <div className="space-y-3">{otherToday.map(renderCard)}</div>
              </section>
            )}
          </>
        )}

        {tab === "week" && (
          <section aria-label="이번 주 행사" className="space-y-3">
            {weekEvents.length > 0 ? weekEvents.map(renderCard) : <EmptyState text="앞으로 7일 동안 열리는 행사가 없어요." />}
          </section>
        )}

        {tab !== "dept" && hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setShowHidden((v) => !v)}
            className="min-h-11 w-full rounded-xl text-sm font-semibold text-slate-600 underline-offset-2 hover:underline"
          >
            {showHidden ? "관심 분야 행사만 보기" : `관심 분야가 아닌 행사 ${hiddenCount}건 더 보기`}
          </button>
        )}

        {tab === "dept" &&
          (!dept || !profile.grade ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
              <Users aria-hidden className="size-8 text-slate-500" />
              <p className="text-[15px] font-semibold text-slate-800">학과·학년을 골라 주세요</p>
              <p className="text-sm text-slate-600">같은 학과·학년 학생이 등록한 행사가 여기에 모여요.</p>
              <Link href="/settings" className="mt-1 min-h-11 px-3 py-2.5 text-sm font-semibold text-indigo-700">
                설정에서 고르기
              </Link>
            </div>
          ) : (
            <section aria-label="우리 학과 행사" className="space-y-3">
              <p className="text-sm text-slate-600">
                {dept.name} {profile.grade}학년 학생들이 등록한 행사예요. 내가 공유한 행사도 함께 보여요.
              </p>
              {deptFeed.length > 0 ? (
                deptFeed.map((e) => {
                  const own = feedById.get(e.id)?.mine;
                  // 내가 공유한 행사는 내 행사 카드로 보여 줍니다
                  const mineEvent = own ? state.events.find((x) => x.sharedEventId === e.sharedEventId) : undefined;
                  return renderCard(mineEvent ? { ...mineEvent } : e);
                })
              ) : (
                <EmptyState text="아직 같은 학과 학생이 공유한 행사가 없어요." />
              )}
            </section>
          ))}
      </div>

      <Link
        href="/add"
        className="fixed right-[max(1rem,calc(50%-215px+1rem))] bottom-[calc(5rem+env(safe-area-inset-bottom))] z-20 flex min-h-12 items-center gap-1.5 rounded-full bg-indigo-600 py-3 pr-5 pl-4 text-[15px] font-semibold text-white shadow-lg shadow-indigo-600/30 active:bg-indigo-700"
      >
        <Plus aria-hidden className="size-5" />
        공지 추가
      </Link>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-600">
      {text}
    </p>
  );
}
