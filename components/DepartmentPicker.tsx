"use client";

import { useState } from "react";
import { Check, Search } from "lucide-react";
import { inputClass } from "./ui";
import { DEPARTMENTS } from "@/config/departments";

/** 학과 고정 목록에서 검색해 고르기 (자유 입력 없음) */
export function DepartmentPicker({
  selected,
  onSelect,
  autoFocus = false,
}: {
  selected: string | null;
  onSelect: (code: string) => void;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState("");
  const q = query.replace(/\s/g, "");
  const list = DEPARTMENTS.filter((d) => !q || d.name.includes(q) || d.college.includes(q));
  return (
    <div>
      <div className="relative mb-2">
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500" />
        <input
          autoFocus={autoFocus}
          type="search"
          aria-label="학과 검색"
          placeholder="학과 이름으로 찾기"
          className={`${inputClass} pl-9`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <ul className="max-h-[55dvh] divide-y divide-slate-100 overflow-y-auto">
        {list.map((d) => (
          <li key={d.code}>
            <button
              type="button"
              onClick={() => onSelect(d.code)}
              className="flex min-h-12 w-full items-center gap-2 px-1 text-left"
            >
              <span className="flex-1">
                <span className="block text-[15px] font-medium text-slate-900">{d.name}</span>
                <span className="block text-xs text-slate-600">{d.college}</span>
              </span>
              {selected === d.code && <Check aria-label="선택됨" className="size-5 text-indigo-600" />}
            </button>
          </li>
        ))}
        {list.length === 0 && <li className="py-6 text-center text-sm text-slate-600">찾는 학과가 없어요.</li>}
      </ul>
    </div>
  );
}
