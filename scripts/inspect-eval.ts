import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function escapeUnicode(value: string): string {
  return value.replace(/[^\x00-\x7F]/g, (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`);
}

async function main() {
  const results = await prisma.evalResult.findMany({
    where: { passed: false },
    orderBy: { createdAt: "desc" },
    take: 8,
    include: {
      evalCase: true,
      agentRun: true,
    },
  });
  for (const result of results) {
    const output = result.agentRun.outputParsed as any;
    const tools = output?.proposed_actions?.map((action: any) => action.tool) ?? [];
    const context = result.agentRun.contextSnapshot as any;
    console.log(
      JSON.stringify({
        id: result.id,
        caseName: escapeUnicode(result.evalCase.name),
        query: escapeUnicode(result.evalCase.userQuery),
        category: result.evalCase.category,
        failureCategory: result.failureCategory,
        runStatus: result.agentRun.status,
        failureReason: result.agentRun.failureReason,
        tools,
        summary: escapeUnicode(output?.summary ?? ""),
        clarifications: output?.clarification_questions ?? [],
        proposed: output?.proposed_actions?.map((action: any) => ({
          tool: action.tool,
          args: action.args,
        })),
        contextTaskCounts: {
          today: context?.todayTasks?.length ?? null,
          next7: context?.next7DaysTasks?.length ?? null,
          overdue: context?.overdueUndoneTasks?.length ?? null,
        },
        contextTodayFirstTitle: context?.todayTasks?.[0]?.title ?? null,
      }),
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
