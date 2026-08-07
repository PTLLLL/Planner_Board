import { z } from "zod";

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式必须为 YYYY-MM-DD");
const timeKey = z.string().regex(/^\d{2}:\d{2}$/, "时间格式必须为 HH:mm");
const uuid = z.string().uuid();

export const registerSchema = z.object({
  email: z.string().email("邮箱格式不正确"),
  password: z
    .string()
    .min(6, "密码长度不得少于 6 位")
    .regex(/[A-Z]/, "密码必须包含大写字母")
    .regex(/[a-z]/, "密码必须包含小写字母")
    .regex(/[0-9]/, "密码必须包含数字")
    .regex(/[^A-Za-z0-9]/, "密码必须包含符号"),
  displayName: z.string().min(1).max(60).optional(),
});

export const loginSchema = z.object({
  email: z.string().email("邮箱格式不正确"),
  password: z.string().min(1, "请输入密码"),
});

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1, "显示名称不能为空").max(60).optional(),
});

export const preferenceSchema = z
  .object({
    timezone: z.string().min(1).max(80).optional(),
    maxDailyTasks: z.number().int().min(1).max(12).optional(),
    workStartTime: timeKey.optional(),
    workEndTime: timeKey.optional(),
    preferredFocusTime: z.enum(["morning", "afternoon", "evening"]).optional(),
  })
  .refine(
    (data) => {
      if (data.workStartTime && data.workEndTime && data.workEndTime <= data.workStartTime) {
        return false;
      }
      return true;
    },
    { message: "结束时间必须晚于开始时间", path: ["workEndTime"] },
  );

export const goalCreateSchema = z.object({
  title: z.string().trim().min(1, "标题不能为空").max(120),
  description: z.string().trim().max(1000).optional(),
  targetDate: dateKey.optional(),
});

export const goalUpdateSchema = goalCreateSchema.partial();

const taskFields = z.object({
  title: z.string().trim().min(1, "标题不能为空").max(160),
  description: z.string().trim().max(1000).optional(),
  dateKey,
  startTime: timeKey.optional(),
  endTime: timeKey.optional(),
  estimateMinutes: z.number().int().min(5).max(480).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  goalId: uuid.optional(),
});

export const taskCreateSchema = taskFields.refine(
  (data) => !data.startTime || !data.endTime || data.endTime > data.startTime,
  {
    message: "结束时间不得早于或等于开始时间",
    path: ["endTime"],
  },
);

export const taskUpdateSchema = taskFields.partial().refine(
  (data) => !data.startTime || !data.endTime || data.endTime > data.startTime,
  {
    message: "结束时间不得早于或等于开始时间",
    path: ["endTime"],
  },
);

export const moveTaskSchema = z.object({
  newDateKey: dateKey,
});

export const agentChatSchema = z.object({
  requestText: z.string().trim().min(1).max(2000),
  trigger: z.enum([
    "dashboard_plan_today",
    "agent_input",
    "goal_decompose",
    "daily_task_move",
    "daily_task_split",
  ]),
  relatedGoalId: uuid.optional(),
  relatedTaskId: uuid.optional(),
});

export const agentActionEditSchema = z.object({
  args: z.record(z.unknown()),
});

export const agentActionApproveSchema = z.object({
  subtaskIndices: z.array(z.number().int().min(0).max(7)).optional(),
});

export const feedbackSchema = z.object({
  feedbackType: z.enum([
    "accepted",
    "rejected",
    "edited",
    "helpful",
    "not_helpful",
    "wrong_date",
    "wrong_task",
    "wrong_priority",
    "too_many_tasks",
    "unsafe_suggestion",
  ]),
  comment: z.string().trim().max(1000).optional(),
});

const legacyItem = z.object({
  id: z.string().optional(),
  text: z.string().min(1).max(160),
  done: z.boolean().optional(),
});

export const importSchema = z.object({
  legacyData: z.object({
    focuses: z.array(
      z.object({
        id: z.string().optional(),
        text: z.string().min(1).max(120),
        done: z.boolean().optional(),
      }),
    ),
    days: z.record(dateKey, z.array(legacyItem)).default({}),
  }),
});

export const evalRunSchema = z.object({
  caseIds: z.array(uuid).optional(),
  categories: z
    .array(
      z.enum([
        "plan_today",
        "create_task",
        "update_task",
        "move_task",
        "split_task",
        "decompose_goal",
        "clarification",
        "safety",
      ]),
    )
    .optional(),
});

export const analyticsEventSchema = z.object({
  eventName: z.string().min(1).max(80),
  sessionId: z.string().min(1).max(120),
  pageRoute: z.string().max(160).optional(),
  clientTimestamp: z.string().datetime().optional(),
  properties: z.record(z.unknown()).default({}),
});

export const querySchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
