// fixtures/notices 10건으로 날짜·시간·장소 추출 정확도를 잽니다 (FR-3 수용 기준 90%).
// - 대체 파서: 항상 실행
// - AI 추출: ANTHROPIC_API_KEY가 있고 EVAL_AI=1일 때만 실행 (`EVAL_AI=1 npm run test -- fixtures`)
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseNoticeFallback } from "./fallbackParser";
import { maskPersonalInfo } from "./mask";
import { normalizeExtracted, type ExtractedEvent } from "./schema";

const DIR = join(process.cwd(), "fixtures/notices");
const spec = JSON.parse(readFileSync(join(DIR, "expected.json"), "utf8")) as {
  baseDate: string;
  postedAt: string;
  notices: { file: string; date: string | null; startTime: string | null; location: string | null }[];
};

const norm = (v: string | null | undefined) => (v ? v.replace(/\s/g, "").replace(/호$/, "") : null);

function score(results: (ExtractedEvent | undefined)[]) {
  let correct = 0;
  const misses: string[] = [];
  spec.notices.forEach((n, i) => {
    const r = results[i];
    for (const field of ["date", "startTime", "location"] as const) {
      const ok = norm(r?.[field]) === norm(n[field]);
      if (ok) correct++;
      else misses.push(`${n.file} ${field}: 기대 ${n[field]} / 결과 ${r?.[field] ?? null}`);
    }
  });
  return { accuracy: correct / (spec.notices.length * 3), misses };
}

const texts = spec.notices.map((n) => maskPersonalInfo(readFileSync(join(DIR, n.file), "utf8")));

describe("fixtures/notices 추출 정확도", () => {
  it("대체 파서 (데모용 하한선 70%)", () => {
    const { accuracy, misses } = score(texts.map((t) => normalizeExtracted(parseNoticeFallback(t, spec.baseDate))));
    console.log(`[대체 파서] 날짜·시간·장소 정확도 ${(accuracy * 100).toFixed(1)}%`);
    if (misses.length) console.log("  틀린 항목:\n  " + misses.join("\n  "));
    expect(accuracy).toBeGreaterThanOrEqual(0.7);
  });

  it.runIf(process.env.EVAL_AI === "1" && !!process.env.ANTHROPIC_API_KEY)("AI 추출 (수용 기준 90%)", async () => {
    const { runExtraction } = await import("./run");
    const results = [];
    for (const text of texts) {
      const r = await runExtraction({ mode: "text", text, source: "kakao", postedAt: spec.postedAt });
      results.push(r.events[0]);
    }
    const { accuracy, misses } = score(results);
    console.log(`[AI 추출] 날짜·시간·장소 정확도 ${(accuracy * 100).toFixed(1)}%`);
    if (misses.length) console.log("  틀린 항목:\n  " + misses.join("\n  "));
    expect(accuracy).toBeGreaterThanOrEqual(0.9);
  });
});
