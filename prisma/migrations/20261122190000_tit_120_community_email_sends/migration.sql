-- CreateTable
CREATE TABLE "community_email_sends" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "campaign" VARCHAR(40) NOT NULL,
    "sent_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_email_sends_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "community_email_sends_user_id_campaign_key" ON "community_email_sends"("user_id", "campaign");

-- AddForeignKey
ALTER TABLE "community_email_sends" ADD CONSTRAINT "community_email_sends_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
