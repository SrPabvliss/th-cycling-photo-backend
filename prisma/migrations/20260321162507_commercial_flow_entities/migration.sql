-- CreateEnum
CREATE TYPE "preview_link_status" AS ENUM ('active', 'expired', 'converted');

-- CreateEnum
CREATE TYPE "order_status" AS ENUM ('pending', 'paid', 'delivered', 'cancelled');

-- CreateEnum
CREATE TYPE "delivery_link_status" AS ENUM ('active', 'expired', 'downloaded');

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "whatsapp" VARCHAR(20) NOT NULL,
    "email" VARCHAR(255),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "preview_links" (
    "id" UUID NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "event_id" UUID NOT NULL,
    "status" "preview_link_status" NOT NULL DEFAULT 'active',
    "expires_at" TIMESTAMPTZ NOT NULL,
    "viewed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" UUID NOT NULL,

    CONSTRAINT "preview_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "preview_link_photos" (
    "id" UUID NOT NULL,
    "preview_link_id" UUID NOT NULL,
    "photo_id" UUID NOT NULL,

    CONSTRAINT "preview_link_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "preview_link_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "status" "order_status" NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_at" TIMESTAMPTZ,
    "delivered_at" TIMESTAMPTZ,
    "cancelled_at" TIMESTAMPTZ,
    "confirmed_by_id" UUID,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_photos" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "photo_id" UUID NOT NULL,

    CONSTRAINT "order_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_links" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "status" "delivery_link_status" NOT NULL DEFAULT 'active',
    "expires_at" TIMESTAMPTZ NOT NULL,
    "first_downloaded_at" TIMESTAMPTZ,
    "download_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customers_whatsapp_key" ON "customers"("whatsapp");

-- CreateIndex
CREATE INDEX "customers_email_idx" ON "customers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "preview_links_token_key" ON "preview_links"("token");

-- CreateIndex
CREATE INDEX "preview_links_event_id_idx" ON "preview_links"("event_id");

-- CreateIndex
CREATE INDEX "preview_links_status_idx" ON "preview_links"("status");

-- CreateIndex
CREATE INDEX "preview_links_created_by_id_idx" ON "preview_links"("created_by_id");

-- CreateIndex
CREATE INDEX "preview_links_expires_at_idx" ON "preview_links"("expires_at");

-- CreateIndex
CREATE INDEX "preview_link_photos_preview_link_id_idx" ON "preview_link_photos"("preview_link_id");

-- CreateIndex
CREATE INDEX "preview_link_photos_photo_id_idx" ON "preview_link_photos"("photo_id");

-- CreateIndex
CREATE UNIQUE INDEX "preview_link_photos_preview_link_id_photo_id_key" ON "preview_link_photos"("preview_link_id", "photo_id");

-- CreateIndex
CREATE INDEX "orders_preview_link_id_idx" ON "orders"("preview_link_id");

-- CreateIndex
CREATE INDEX "orders_event_id_idx" ON "orders"("event_id");

-- CreateIndex
CREATE INDEX "orders_customer_id_idx" ON "orders"("customer_id");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "orders_confirmed_by_id_idx" ON "orders"("confirmed_by_id");

-- CreateIndex
CREATE INDEX "orders_created_at_idx" ON "orders"("created_at" DESC);

-- CreateIndex
CREATE INDEX "order_photos_order_id_idx" ON "order_photos"("order_id");

-- CreateIndex
CREATE INDEX "order_photos_photo_id_idx" ON "order_photos"("photo_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_photos_order_id_photo_id_key" ON "order_photos"("order_id", "photo_id");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_links_order_id_key" ON "delivery_links"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_links_token_key" ON "delivery_links"("token");

-- CreateIndex
CREATE INDEX "delivery_links_status_idx" ON "delivery_links"("status");

-- CreateIndex
CREATE INDEX "delivery_links_expires_at_idx" ON "delivery_links"("expires_at");

-- AddForeignKey
ALTER TABLE "preview_links" ADD CONSTRAINT "preview_links_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preview_links" ADD CONSTRAINT "preview_links_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preview_link_photos" ADD CONSTRAINT "preview_link_photos_preview_link_id_fkey" FOREIGN KEY ("preview_link_id") REFERENCES "preview_links"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preview_link_photos" ADD CONSTRAINT "preview_link_photos_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "photos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_preview_link_id_fkey" FOREIGN KEY ("preview_link_id") REFERENCES "preview_links"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_confirmed_by_id_fkey" FOREIGN KEY ("confirmed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_photos" ADD CONSTRAINT "order_photos_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_photos" ADD CONSTRAINT "order_photos_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "photos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_links" ADD CONSTRAINT "delivery_links_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
