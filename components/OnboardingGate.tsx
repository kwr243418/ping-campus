"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { STORAGE_KEYS, readJSON } from "@/lib/storage";

/** 첫 실행이면 온보딩(S01)으로 보냅니다 */
export function OnboardingGate() {
  const router = useRouter();
  useEffect(() => {
    if (!readJSON<boolean>(STORAGE_KEYS.onboarded, false)) router.replace("/onboarding");
  }, [router]);
  return null;
}
