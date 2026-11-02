-- CreateTable
CREATE TABLE "cdn_transformation_sightings" (
    "id" UUID NOT NULL,
    "month" CHAR(7) NOT NULL,
    "combination_key" CHAR(64) NOT NULL,
    "kind" VARCHAR(10) NOT NULL,
    "slug" VARCHAR(30) NOT NULL,
    "first_seen_on" DATE NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cdn_transformation_sightings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cdn_retired_slugs" (
    "slug" VARCHAR(30) NOT NULL,
    "photo_id" VARCHAR(80) NOT NULL,
    "event_id" UUID NOT NULL,
    "retired_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cdn_retired_slugs_pkey" PRIMARY KEY ("slug")
);

-- CreateTable
CREATE TABLE "cdn_transformation_report_days" (
    "day" DATE NOT NULL,
    "new_combinations" INTEGER NOT NULL,
    "processed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cdn_transformation_report_days_pkey" PRIMARY KEY ("day")
);

-- CreateIndex
CREATE INDEX "idx_cdn_transformation_sightings_day" ON "cdn_transformation_sightings"("first_seen_on");

-- CreateIndex
CREATE UNIQUE INDEX "uq_cdn_transformation_sightings_month_key" ON "cdn_transformation_sightings"("month", "combination_key");

