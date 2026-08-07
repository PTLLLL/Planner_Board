import { NextRequest } from "next/server";
import { fail, ok, parseWithSchema, readJson, requireUser } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { importSchema } from "@/lib/schemas";
import { executeImport } from "@/lib/services/import.service";
import { rateLimitCheck } from "@/lib/services/rate-limit.service";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const allowed = await rateLimitCheck("import-execute", user.id, 3, 24 * 60 * 60 * 1000);
    if (!allowed) throw new AppError("RATE_LIMITED", "今日导入次数已达上限", 429);
    const body = parseWithSchema(importSchema, await readJson(request));
    const legacyData = { ...body.legacyData, days: body.legacyData.days ?? {} };
    return ok(await executeImport(user.id, legacyData));
  } catch (error) {
    return fail(error);
  }
}
