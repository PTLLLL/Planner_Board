import { NextRequest } from "next/server";
import { fail, ok, parseWithSchema, readJson, requireUser } from "@/lib/api";
import { importSchema } from "@/lib/schemas";
import { previewImport } from "@/lib/services/import.service";
import { emitServerEvent } from "@/lib/services/metrics.service";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const body = parseWithSchema(importSchema, await readJson(request));
    const legacyData = { ...body.legacyData, days: body.legacyData.days ?? {} };
    const report = await previewImport(user.id, legacyData);
    await emitServerEvent(user.id, "import_previewed", {
      goals_to_create: report.goalsCreated,
      goals_to_skip: report.goalsSkipped,
      tasks_to_create: report.tasksCreated,
      tasks_to_skip: report.tasksSkipped,
      failure_count: report.failures.length,
    });
    return ok(report);
  } catch (error) {
    return fail(error);
  }
}
