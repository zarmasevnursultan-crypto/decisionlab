import type { ApiResponse } from "./case-types";
import { ApiError } from "./api-error";

export async function api<T>(url: string, body?: object, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try { response = await fetch(url, { method: body ? "POST" : "GET", headers: body ? { "Content-Type": "application/json" } : {}, ...(body ? { body: JSON.stringify(body) } : {}), cache: "no-store", signal }); }
  catch (error) { if (signal?.aborted) throw error; throw new ApiError("NETWORK_ERROR", "Не удалось подключиться к серверу. Проверьте соединение и повторите запрос."); }
  const result = await response.json().catch(() => null) as ApiResponse<T> | null;
  if (!result) throw new ApiError("INVALID_RESPONSE", "Сервер вернул нечитаемый ответ.");
  if (!result.success) throw new ApiError(result.error.code, result.error.message, response.status, result.error.details);
  return result.data;
}
