import { NextRequest } from "next/server";
import { fail, ok, parseWithSchema, readJson, requireUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { analyticsEventSchema } from "@/lib/schemas";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const body = parseWithSchema(analyticsEventSchema, await readJson(request));
    await prisma.analyticsEvent.create({
      data: {
        eventName: body.eventName,
        userId: user.id,
        sessionId: body.sessionId,
        pageRoute: body.pageRoute ?? null,
        clientTimestamp: body.clientTimestamp ? new Date(body.clientTimestamp) : new Date(),
        appVersion: "1.0.0",
        properties: body.properties as Prisma.InputJsonValue,
      },
    });
    return ok(null, 201);
  } catch (error) {
    return fail(error);
  }
}
