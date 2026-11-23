"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, BellOff, Bus, Trash2, Zap } from "lucide-react";
import { Loading, PageHeader } from "./ui";
import { clearInbox, markAllRead, readInbox, type InboxItem } from "@/lib/client/inbox";
import { formatShortDate, toDateString, toTimeString } from "@/lib/dates";
import { STORAGE_EVENT } from "@/lib/storage";

const KIND = {
  beforeEvent: { label: "행사 전 알림", Icon: Bell, cls: "bg-indigo-50 text-indigo-700" },
  atGoHome: { label: "귀가 시간 알림", Icon: Bus, cls: "bg-emerald-50 text-emerald-800" },
  deptUrgent: { label: "우리 학과 긴급", Icon: Zap, cls: "bg-amber-100 text-amber-900" },
} as const;

// S10 알림센터: 받은 알림 목록 (푸시 권한이 없어도 여기에 쌓입니다)
export function NotificationCenter() {
  const [items, setItems] = useState<InboxItem[] | null>(null);
  const [unreadIds, setUnreadIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = () => setItems(readInbox());
    const first = readInbox();
    setItems(first);
    // 들어온 순간 읽음 처리하되, 이번 방문 동안은 '새 알림' 표시를 유지합니다
    setUnreadIds(new Set(first.filter((i) => !i.read).map((i) => i.id)));
    markAllRead();
    window.addEventListener(STORAGE_EVENT, load);
    return () => window.removeEventListener(STORAGE_EVENT, load);
  }, []);

  if (!items) return <Loading />;

  return (
    <div className="pb-10">
      <PageHeader
        title="알림센터"
        backHref="/"
        backLabel="홈으로"
        right={
          items.length > 0 ? (
            <button
              type="button"
              onClick={() => window.confirm("받은 알림을 모두 지울까요?") && clearInbox()}
              className="flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-semibold text-slate-600 active:bg-slate-100"
            >
              <Trash2 aria-hidden className="size-4" />
              모두 지우기
            </button>
          ) : undefined
        }
      />
      <div className="px-4 pt-4">
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
            <BellOff aria-hidden className="size-8 text-slate-500" />
            <p className="text-[15px] font-semibold text-slate-800">받은 알림이 없어요</p>
            <p className="text-sm text-slate-600">
              행사 1시간 전·귀가 시간·우리 학과 긴급 알림이 여기에 모여요. 설정의 테스트 모드에서 시각을 바꿔 확인해 볼 수 있어요.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
            {items.map((i) => {
              const k = KIND[i.kind];
              const at = new Date(i.at);
              return (
                <li key={i.id}>
                  <Link href={i.url} className="flex gap-3 px-4 py-3.5 active:bg-slate-50">
                    <span className={`grid size-10 shrink-0 place-items-center rounded-full ${k.cls}`}>
                      <k.Icon aria-hidden className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-xs text-slate-600">
                        <span className="font-semibold">{k.label}</span>
                        <span>
                          {formatShortDate(toDateString(at))} {toTimeString(at)}
                        </span>
                        {unreadIds.has(i.id) && (
                          <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">새 알림</span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-[15px] font-semibold text-slate-900">
                        {i.title.replace(/^\[핑캠퍼스\]\s*/, "")}
                      </span>
                      <span className="block text-sm text-slate-700">{i.body}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
