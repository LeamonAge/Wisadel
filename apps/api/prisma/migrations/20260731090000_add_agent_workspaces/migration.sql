CREATE TYPE "WorkspaceTrust" AS ENUM ('UNTRUSTED', 'TRUSTED');
CREATE TYPE "AgentApproval" AS ENUM ('PENDING', 'ONCE', 'ALWAYS_WORKSPACE', 'DENIED');

CREATE TABLE "workspaces" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "path" VARCHAR(1000) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "trust" "WorkspaceTrust" NOT NULL DEFAULT 'UNTRUSTED',
  "settings" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "workspaces_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "agent_audit_entries" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "workspace_id" UUID,
  "tool" VARCHAR(100) NOT NULL,
  "input_summary" TEXT NOT NULL,
  "status" "AgentApproval" NOT NULL DEFAULT 'PENDING',
  "result_summary" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agent_audit_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "agent_audit_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "agent_audit_entries_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "workspaces_user_id_path_key" ON "workspaces"("user_id", "path");
CREATE INDEX "workspaces_user_id_updated_at_idx" ON "workspaces"("user_id", "updated_at" DESC);
CREATE INDEX "agent_audit_entries_user_id_created_at_idx" ON "agent_audit_entries"("user_id", "created_at" DESC);
CREATE INDEX "agent_audit_entries_workspace_id_created_at_idx" ON "agent_audit_entries"("workspace_id", "created_at" DESC);
