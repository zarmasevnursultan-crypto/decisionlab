import "server-only";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { ApiError } from "./api-error";
import type { ApiResponse } from "./case-types";

export const COOKIE_NAME = "decisionlab_session";
export const PLAYER_COOKIE = "decisionlab_player";
export const cookieOptions = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 90 * 86400 };
export const newToken = () => randomBytes(32).toString("base64url");
export function ok<T>(data: T, message = "Готово", status = 200) {
  return NextResponse.json<ApiResponse<T>>({ success: true, data, message }, { status, headers: { "Cache-Control": "no-store" } });
}
export async function handle(action: () => Promise<NextResponse>) {
  try { return await action(); }
  catch (error) {
    if (!(error instanceof ApiError)) console.error("[api]", error);
    const failure = error instanceof ApiError ? error : new ApiError("INTERNAL_ERROR", "Сервер не смог выполнить запрос. Попробуйте ещё раз.", 500);
    return NextResponse.json<ApiResponse<never>>({ success: false, error: { code: failure.code, message: failure.message, ...(failure.details ? { details: failure.details } : {}) } }, { status: failure.status, headers: { "Cache-Control": "no-store" } });
  }
}
export async function readBody(request: Request): Promise<Record<string, unknown>> {
  if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) throw new ApiError("ORIGIN_MISMATCH", "Запрос должен быть отправлен с сайта DecisionLab.", 403);
  const raw = await request.text();
  if (raw.length > 16000) throw new ApiError("REQUEST_TOO_LARGE", "Слишком большой запрос.", 413);
  let body: unknown;
  try { body = raw ? JSON.parse(raw) : {}; } catch { throw new ApiError("INVALID_JSON", "Тело запроса должно содержать корректный JSON."); }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ApiError("INVALID_REQUEST", "Ожидается JSON-объект.");
  return body as Record<string, unknown>;
}
export function uuid(value: unknown, field: string) {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new ApiError("VALIDATION_ERROR", `Поле ${field} должно содержать UUID.`, 422, { field });
  return value;
}
export async function identity(required = true) {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  const player = jar.get(PLAYER_COOKIE)?.value;
  if (required && (!token || !player)) throw new ApiError("SESSION_NOT_FOUND", "Игровая сессия не найдена. Начните расследование.", 401);
  return { token: token ?? "", player: player ?? "" };
}
