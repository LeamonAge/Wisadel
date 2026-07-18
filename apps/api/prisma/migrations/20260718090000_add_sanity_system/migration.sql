ALTER TABLE "users" ADD COLUMN "sanity_milli" INTEGER NOT NULL DEFAULT 100000;

CREATE TABLE "sanity_ledger_entries" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "delta_milli" INTEGER NOT NULL,
    "balance_after_milli" INTEGER NOT NULL,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "model" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sanity_ledger_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sanity_ledger_entries_user_id_created_at_idx" ON "sanity_ledger_entries"("user_id", "created_at" DESC);

ALTER TABLE "sanity_ledger_entries" ADD CONSTRAINT "sanity_ledger_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
