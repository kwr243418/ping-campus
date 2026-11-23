import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";

export async function parseBody<T extends z.ZodTypeAny>(
  request: Request,
  schema: T,
): Promise<{ data: z.infer<T> } | { error: NextResponse }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { error: NextResponse.json({ error: "요청 형식이 올바르지 않아요." }, { status: 400 }) };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return { error: NextResponse.json({ error: parsed.error.issues[0]?.message ?? "입력을 확인해 주세요." }, { status: 400 }) };
  }
  return { data: parsed.data };
}

export function serverError(tag: string, err: unknown) {
  console.error(`[${tag}]`, err);
  return NextResponse.json({ error: "잠시 후 다시 시도해 주세요." }, { status: 500 });
}
