import { prisma } from "@/lib/db";

interface AuditLogInput {
  userId: string;
  agentActionId?: string | null;
  entityType: "task" | "goal" | "import";
  entityId?: string | null;
  actionType: "create" | "update" | "move" | "split" | "complete" | "uncomplete" | "delete" | "import";
  beforeState?: unknown;
  afterState?: unknown;
}

export async function writeAuditLog(input: AuditLogInput): Promise<void> {
  await prisma.actionLog.create({
    data: {
      userId: input.userId,
      agentActionId: input.agentActionId ?? null,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      actionType: input.actionType,
      beforeState: input.beforeState ?? undefined,
      afterState: input.afterState ?? undefined,
    },
  });
}
