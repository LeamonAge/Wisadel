CREATE TYPE "LocalAgentActionStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'DENIED', 'FAILED');
CREATE TABLE "local_agent_actions" (
  "id" UUID NOT NULL, "user_id" UUID NOT NULL, "workspace_id" UUID NOT NULL, "tool" VARCHAR(100) NOT NULL, "input" JSONB NOT NULL,
  "status" "LocalAgentActionStatus" NOT NULL DEFAULT 'PENDING', "result" JSONB, "error" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "local_agent_actions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "local_agent_actions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "local_agent_actions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "local_agent_actions_user_id_status_created_at_idx" ON "local_agent_actions"("user_id", "status", "created_at");
CREATE INDEX "local_agent_actions_workspace_id_status_created_at_idx" ON "local_agent_actions"("workspace_id", "status", "created_at");
