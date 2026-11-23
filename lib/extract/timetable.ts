// 시간표 캡처 인식 (P1, 서버 전용). 요일·시작·종료·과목명·강의실만 추출하고, 이름·학번은 무시합니다.
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { isValidTime } from "../dates";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";

export const TimetableExtractionSchema = z.object({
  classes: z.array(
    z.object({
      weekday: z.number().int().describe("1=월, 2=화, 3=수, 4=목, 5=금, 6=토"),
      start: z.string().describe("24시간제 HH:mm"),
      end: z.string().describe("24시간제 HH:mm"),
      name: z.string().nullable().describe("과목명"),
      room: z.string().nullable().describe("강의실"),
    }),
  ),
});

export interface RecognizedClass {
  weekday: 1 | 2 | 3 | 4 | 5 | 6;
  start: string;
  end: string;
  name?: string;
  room?: string;
}

const SYSTEM = `당신은 대학생 수업 시간표 캡처(에브리타임 등)에서 수업 블록을 읽는 도우미입니다.
- 각 수업 블록의 요일, 시작·종료 시각, 과목명, 강의실만 추출하세요.
- 이미지에 보이는 사람 이름, 학번, 교수명, 연락처는 결과에 넣지 마세요.
- 시각은 격자의 시간 눈금을 기준으로 24시간제 HH:mm로 읽고, 5분 단위로 맞추세요. 확실하지 않으면 가장 가까운 눈금으로 읽으세요.
- 같은 과목이 여러 요일에 있으면 요일마다 따로 넣으세요.
- 일요일 수업이나 시간표가 아닌 이미지라면 빈 배열을 돌려주세요.`;

export async function recognizeTimetable(image: { data: string; mediaType: "image/jpeg" | "image/png" | "image/webp" }) {
  const client = new Anthropic();
  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(TimetableExtractionSchema) },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data } },
          { type: "text", text: "이 시간표 캡처에서 수업 블록을 추출해 주세요." },
        ],
      },
    ],
  });
  if (response.stop_reason === "refusal") throw new Error("model refusal");
  const checked = TimetableExtractionSchema.safeParse(response.parsed_output);
  if (!checked.success) throw new Error("schema validation failed");

  const pad = (t: string) => t.trim().replace(/^(\d):/, "0$1:");
  return checked.data.classes
    .map((c) => ({ ...c, start: pad(c.start), end: pad(c.end) }))
    .filter((c) => c.weekday >= 1 && c.weekday <= 6 && isValidTime(c.start) && isValidTime(c.end) && c.end > c.start)
    .map(
      (c): RecognizedClass => ({
        weekday: c.weekday as RecognizedClass["weekday"],
        start: c.start,
        end: c.end,
        name: c.name?.trim() || undefined,
        room: c.room?.trim() || undefined,
      }),
    );
}
