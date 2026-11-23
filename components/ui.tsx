"use client";

import Link from "next/link";
import { ChevronLeft, X } from "lucide-react";
import { useEffect, useId } from "react";

export function PageHeader({
  title,
  backHref,
  backLabel = "뒤로",
  right,
}: {
  title: string;
  backHref?: string;
  backLabel?: string;
  right?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-10 flex min-h-14 items-center gap-1 border-b border-slate-200 bg-slate-50/95 px-2 pt-[env(safe-area-inset-top)] backdrop-blur">
      {backHref ? (
        <Link
          href={backHref}
          aria-label={backLabel}
          className="grid size-11 place-items-center rounded-full text-slate-700 active:bg-slate-200"
        >
          <ChevronLeft aria-hidden className="size-6" />
        </Link>
      ) : (
        <span className="w-2" />
      )}
      <h1 className="flex-1 text-lg font-bold text-slate-900">{title}</h1>
      {right}
    </header>
  );
}

export function Loading() {
  return (
    <p className="p-4 text-sm text-slate-500" aria-busy="true">
      불러오는 중이에요…
    </p>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: React.ReactNode;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className={`flex min-h-14 items-center gap-3 py-2 ${disabled ? "opacity-60" : ""}`}>
      <div className="flex-1">
        <label htmlFor={id} className="text-[15px] font-semibold text-slate-900">
          {label}
        </label>
        {description && <p className="mt-0.5 text-sm text-slate-600">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-8 w-13 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
          checked ? "bg-indigo-600" : "bg-slate-300"
        }`}
      >
        <span
          className={`absolute top-1 left-1 size-6 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : ""
          }`}
        />
        <span className="sr-only">{checked ? "켜짐" : "꺼짐"}</span>
      </button>
    </div>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-slate-200/70 p-1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-11 rounded-lg px-2 text-sm font-semibold ${
            value === o.value ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function BottomSheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <button type="button" aria-label="닫기" className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative max-h-[88dvh] w-full max-w-[430px] overflow-y-auto rounded-t-3xl bg-white px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]"
      >
        <div className="mb-2 flex items-center">
          <h2 className="flex-1 text-lg font-bold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="grid size-11 place-items-center rounded-full text-slate-600 active:bg-slate-100"
          >
            <X aria-hidden className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
  warn,
}: {
  label: string;
  children: React.ReactNode;
  hint?: React.ReactNode;
  warn?: boolean;
}) {
  return (
    <label className="block">
      <span className={`mb-1 flex items-center gap-1.5 text-sm font-semibold ${warn ? "text-amber-900" : "text-slate-700"}`}>
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-600">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "block min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-2 focus:outline-indigo-200";

export const primaryButtonClass =
  "flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-[15px] font-semibold text-white active:bg-indigo-700 disabled:bg-slate-300 disabled:text-slate-600";

export const secondaryButtonClass =
  "flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-[15px] font-semibold text-slate-800 active:bg-slate-100";
