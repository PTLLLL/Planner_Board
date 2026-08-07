-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('active', 'completed', 'archived');

-- CreateEnum
CREATE TYPE "GoalSource" AS ENUM ('manual', 'imported');

-- CreateEnum
CREATE TYPE "TaskSource" AS ENUM ('manual', 'agent', 'imported');

-- CreateEnum
CREATE TYPE "AgentRunStatus" AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "AgentActionStatus" AS ENUM ('proposed', 'approved', 'rejected', 'expired', 'executing', 'executed', 'failed');

-- CreateEnum
CREATE TYPE "AgentActionTool" AS ENUM ('create_task', 'update_task', 'move_task', 'split_task');

-- CreateEnum
CREATE TYPE "AgentMessageRole" AS ENUM ('user', 'assistant', 'system', 'tool');

-- CreateEnum
CREATE TYPE "FeedbackType" AS ENUM ('accepted', 'rejected', 'edited', 'helpful', 'not_helpful', 'wrong_date', 'wrong_task', 'wrong_priority', 'too_many_tasks', 'unsafe_suggestion');

-- CreateEnum
CREATE TYPE "EvalCaseCategory" AS ENUM ('plan_today', 'create_task', 'update_task', 'move_task', 'split_task', 'decompose_goal', 'clarification', 'safety');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" VARCHAR(60),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "last_login_at" TIMESTAMPTZ(6),
    "locked_until" TIMESTAMPTZ(6),
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "timezone" VARCHAR(80) NOT NULL DEFAULT 'Asia/Shanghai',
    "max_daily_tasks" INTEGER NOT NULL DEFAULT 5,
    "work_start_time" VARCHAR(5) NOT NULL DEFAULT '09:00',
    "work_end_time" VARCHAR(5) NOT NULL DEFAULT '22:00',
    "preferred_focus_time" VARCHAR(20) NOT NULL DEFAULT 'morning',
    "require_confirmation" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goals" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "target_date" DATE,
    "status" "GoalStatus" NOT NULL DEFAULT 'active',
    "source" "GoalSource" NOT NULL DEFAULT 'manual',
    "legacy_id" VARCHAR(120),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "goal_id" UUID,
    "title" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "date_key" DATE NOT NULL,
    "start_time" TIME(0),
    "end_time" TIME(0),
    "estimate_minutes" INTEGER,
    "priority" "Priority" NOT NULL DEFAULT 'medium',
    "is_done" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMPTZ(6),
    "source" "TaskSource" NOT NULL DEFAULT 'manual',
    "agent_action_id" UUID,
    "legacy_id" VARCHAR(120),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_runs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "AgentRunStatus" NOT NULL DEFAULT 'pending',
    "request_text" TEXT NOT NULL,
    "context_snapshot" JSONB NOT NULL,
    "model_name" VARCHAR(120) NOT NULL,
    "prompt_version" VARCHAR(60) NOT NULL,
    "output_raw" TEXT,
    "output_parsed" JSONB,
    "failure_reason" TEXT,
    "started_at" TIMESTAMPTZ(6),
    "finished_at" TIMESTAMPTZ(6),
    "latency_ms" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "agent_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_messages" (
    "id" UUID NOT NULL,
    "agent_run_id" UUID NOT NULL,
    "role" "AgentMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_actions" (
    "id" UUID NOT NULL,
    "agent_run_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "tool" "AgentActionTool" NOT NULL,
    "original_args" JSONB NOT NULL,
    "edited_args" JSONB,
    "explanation" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "risk_level" VARCHAR(20) NOT NULL,
    "status" "AgentActionStatus" NOT NULL DEFAULT 'proposed',
    "result_entity_type" VARCHAR(40),
    "result_entity_id" UUID,
    "failure_reason" TEXT,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "agent_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "agent_action_id" UUID,
    "entity_type" VARCHAR(40) NOT NULL,
    "entity_id" UUID,
    "action_type" VARCHAR(40) NOT NULL,
    "before_state" JSONB,
    "after_state" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "action_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback_events" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "agent_action_id" UUID,
    "feedback_type" "FeedbackType" NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eval_cases" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "category" "EvalCaseCategory" NOT NULL,
    "user_query" TEXT NOT NULL,
    "context_snapshot" JSONB NOT NULL,
    "expected_tools" TEXT[],
    "expected_constraints" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "eval_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eval_results" (
    "id" UUID NOT NULL,
    "eval_case_id" UUID NOT NULL,
    "agent_run_id" UUID NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "tool_call_accuracy" DOUBLE PRECISION NOT NULL,
    "date_parsing_accuracy" DOUBLE PRECISION NOT NULL,
    "plan_quality_score" DOUBLE PRECISION NOT NULL,
    "failure_category" VARCHAR(60),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eval_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" UUID NOT NULL,
    "event_name" VARCHAR(80) NOT NULL,
    "user_id" UUID,
    "session_id" VARCHAR(120) NOT NULL,
    "page_route" VARCHAR(160),
    "request_id" VARCHAR(120),
    "client_timestamp" TIMESTAMPTZ(6) NOT NULL,
    "server_timestamp" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "app_version" VARCHAR(40) NOT NULL,
    "schema_version" VARCHAR(10) NOT NULL DEFAULT '1.0',
    "properties" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_user_id_key" ON "user_preferences"("user_id");

-- CreateIndex
CREATE INDEX "goals_user_id_status_idx" ON "goals"("user_id", "status");

-- CreateIndex
CREATE INDEX "goals_legacy_id_idx" ON "goals"("legacy_id");

-- CreateIndex
CREATE INDEX "tasks_user_date_idx" ON "tasks"("user_id", "date_key");

-- CreateIndex
CREATE INDEX "tasks_goal_idx" ON "tasks"("goal_id");

-- CreateIndex
CREATE INDEX "tasks_agent_action_idx" ON "tasks"("agent_action_id");

-- CreateIndex
CREATE INDEX "tasks_legacy_idx" ON "tasks"("legacy_id");

-- CreateIndex
CREATE INDEX "agent_runs_user_created_idx" ON "agent_runs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "agent_runs_status_idx" ON "agent_runs"("status");

-- CreateIndex
CREATE INDEX "agent_messages_run_idx" ON "agent_messages"("agent_run_id");

-- CreateIndex
CREATE INDEX "agent_actions_run_idx" ON "agent_actions"("agent_run_id");

-- CreateIndex
CREATE INDEX "agent_actions_user_status_idx" ON "agent_actions"("user_id", "status");

-- CreateIndex
CREATE INDEX "agent_actions_expires_idx" ON "agent_actions"("expires_at");

-- CreateIndex
CREATE INDEX "action_logs_user_idx" ON "action_logs"("user_id");

-- CreateIndex
CREATE INDEX "action_logs_action_idx" ON "action_logs"("action_type");

-- CreateIndex
CREATE INDEX "feedback_user_idx" ON "feedback_events"("user_id");

-- CreateIndex
CREATE INDEX "feedback_action_idx" ON "feedback_events"("agent_action_id");

-- CreateIndex
CREATE INDEX "eval_results_case_idx" ON "eval_results"("eval_case_id");

-- CreateIndex
CREATE INDEX "eval_results_run_idx" ON "eval_results"("agent_run_id");

-- CreateIndex
CREATE INDEX "analytics_events_name_created_idx" ON "analytics_events"("event_name", "created_at");

-- CreateIndex
CREATE INDEX "analytics_events_user_created_idx" ON "analytics_events"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "analytics_events_session_idx" ON "analytics_events"("session_id");

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_agent_action_id_fkey" FOREIGN KEY ("agent_action_id") REFERENCES "agent_actions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_messages" ADD CONSTRAINT "agent_messages_agent_run_id_fkey" FOREIGN KEY ("agent_run_id") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_actions" ADD CONSTRAINT "agent_actions_agent_run_id_fkey" FOREIGN KEY ("agent_run_id") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_actions" ADD CONSTRAINT "agent_actions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_logs" ADD CONSTRAINT "action_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_logs" ADD CONSTRAINT "action_logs_agent_action_id_fkey" FOREIGN KEY ("agent_action_id") REFERENCES "agent_actions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_events" ADD CONSTRAINT "feedback_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_events" ADD CONSTRAINT "feedback_events_agent_action_id_fkey" FOREIGN KEY ("agent_action_id") REFERENCES "agent_actions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eval_results" ADD CONSTRAINT "eval_results_eval_case_id_fkey" FOREIGN KEY ("eval_case_id") REFERENCES "eval_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eval_results" ADD CONSTRAINT "eval_results_agent_run_id_fkey" FOREIGN KEY ("agent_run_id") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
