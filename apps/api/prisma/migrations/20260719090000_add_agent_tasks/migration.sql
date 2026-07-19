CREATE TYPE "AgentTaskStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');
CREATE TYPE "AgentTaskStepStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED');

CREATE TABLE "agent_tasks" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "session_id" UUID NOT NULL,
  "content" TEXT NOT NULL,
  "image_urls" JSONB NOT NULL DEFAULT '[]',
  "attachments" JSONB NOT NULL DEFAULT '[]',
  "status" "AgentTaskStatus" NOT NULL DEFAULT 'QUEUED',
  "error_message" TEXT,
  "retry_of_id" UUID,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "agent_tasks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agent_task_steps" (
  "id" UUID NOT NULL,
  "task_id" UUID NOT NULL,
  "position" INTEGER NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "status" "AgentTaskStepStatus" NOT NULL DEFAULT 'QUEUED',
  "detail" TEXT,
  CONSTRAINT "agent_task_steps_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "agent_tasks_user_id_created_at_idx" ON "agent_tasks"("user_id", "created_at" DESC);
CREATE INDEX "agent_tasks_status_created_at_idx" ON "agent_tasks"("status", "created_at");
CREATE UNIQUE INDEX "agent_task_steps_task_id_position_key" ON "agent_task_steps"("task_id", "position");
ALTER TABLE "agent_tasks" ADD CONSTRAINT "agent_tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_tasks" ADD CONSTRAINT "agent_tasks_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_task_steps" ADD CONSTRAINT "agent_task_steps_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "agent_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
