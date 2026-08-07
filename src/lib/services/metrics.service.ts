import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

const APP_VERSION = "1.0.0";

export async function emitServerEvent(
  userId: string | null,
  eventName: string,
  properties: Record<string, unknown> = {},
  requestId?: string | null,
): Promise<void> {
  if (process.env.ANALYTICS_ENABLED === "false") return;
  try {
    await prisma.analyticsEvent.create({
      data: {
        eventName,
        userId,
        sessionId: "server",
        pageRoute: null,
        requestId: requestId ?? null,
        clientTimestamp: new Date(),
        appVersion: APP_VERSION,
        properties: properties as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    console.error("[metrics] analytics write failed", error);
  }
}
