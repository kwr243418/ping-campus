// 행사 목록 공용 판단 (보이기·중복 감지)
import type { Category, Event, MissingField } from "./types";

/** 관심 없는 카테고리는 기본 숨김(M24). 내 일정에 담은 행사는 항상 보임 */
export function isVisibleByInterest(
  event: Event,
  interestCategories: Category[],
  addedEventIds: string[],
): boolean {
  return interestCategories.includes(event.category) || addedEventIds.includes(event.id);
}

export function sortByDateTime(a: Event, b: Event): number {
  return `${a.date} ${a.startTime ?? "99:99"}`.localeCompare(`${b.date} ${b.startTime ?? "99:99"}`);
}

/** 날짜·시작 시각·장소가 비어 있으면 missingFields에 넣습니다 */
export function computeMissingFields(e: Pick<Event, "date" | "startTime" | "location">): MissingField[] {
  const missing: MissingField[] = [];
  if (!e.date) missing.push("date");
  if (!e.startTime) missing.push("startTime");
  if (!e.location?.trim()) missing.push("location");
  return missing;
}

function normalizeTitle(title: string): string {
  return title.replace(/[\s\[\]()【】<>「」『』"'·,.!?~\-]/g, "").toLowerCase();
}

/** 글자 2-gram 자카드 유사도 (0~1) */
export function titleSimilarity(a: string, b: string): number {
  const grams = (s: string) => {
    const n = normalizeTitle(s);
    const set = new Set<string>();
    for (let i = 0; i < n.length - 1; i++) set.add(n.slice(i, i + 2));
    if (n.length === 1) set.add(n);
    return set;
  };
  const A = grams(a);
  const B = grams(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const g of A) if (B.has(g)) inter++;
  return inter / (A.size + B.size - inter);
}

/** 중복 감지(FR-3): 같은 날짜이고 제목이 비슷하거나, 같은 날짜·시작 시각·장소 */
export function findDuplicate(candidate: Event, existing: Event[]): Event | undefined {
  return existing.find((e) => {
    if (e.id === candidate.id || e.date !== candidate.date) return false;
    if (titleSimilarity(e.title, candidate.title) >= 0.5) return true;
    return (
      !!candidate.startTime &&
      e.startTime === candidate.startTime &&
      !!candidate.location &&
      e.location?.replace(/\s/g, "") === candidate.location.replace(/\s/g, "")
    );
  });
}
