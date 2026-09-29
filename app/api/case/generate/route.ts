import { cookieOptions, handle, ok, readBody } from "@/lib/api.server";
import { ApiError } from "@/lib/api-error";
import { generateCase } from "@/lib/generate-case.server";

export const maxDuration = 240;

export async function POST(request: Request) {
  return handle(async () => {
    const body = await readBody(request);
    const mode = body.mode ?? "auto";
    if (mode !== "auto" && mode !== "ai" && mode !== "local" && mode !== "fallback") throw new ApiError("VALIDATION_ERROR", "mode: auto, ai, local или fallback.", 422);
    if (body.previousTitle !== undefined && (typeof body.previousTitle !== "string" || body.previousTitle.length > 300)) throw new ApiError("VALIDATION_ERROR", "previousTitle: строка до 300 символов.", 422);
    const result = await generateCase(typeof body.previousTitle === "string" ? body.previousTitle : "", mode);
    const response = ok(result, result.generation.notice, 201);
    response.cookies.set("decisionlab_previous_case", result.bundle.case.title, cookieOptions);
    return response;
  });
}
