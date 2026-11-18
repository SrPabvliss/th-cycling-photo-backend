-- Who changed the contact phone frozen on an order (orders.snap_phone), and when.
CREATE TABLE "order_contact_changes" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "old_phone" VARCHAR(20),
    "new_phone" VARCHAR(20) NOT NULL,
    "source" VARCHAR(20) NOT NULL,
    "changed_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_contact_changes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "order_contact_changes_order_id_created_at_idx" ON "order_contact_changes"("order_id", "created_at" DESC);

CREATE INDEX "order_contact_changes_changed_by_id_idx" ON "order_contact_changes"("changed_by_id");

ALTER TABLE "order_contact_changes" ADD CONSTRAINT "order_contact_changes_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "order_contact_changes" ADD CONSTRAINT "order_contact_changes_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
