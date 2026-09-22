-- Evaluation schema for the detector x OCR comparison (article experiment).
-- Lives next to the application tables in the development database and never
-- touches them. Apply with: psql ... -f scripts/eval/schema.sql
-- Not a Prisma migration on purpose: nothing here belongs to the product.

create schema if not exists eval;

-- One row per run of one combination over a set of photos. A repeated run is a
-- new row: nothing is overwritten.
create table if not exists eval.runs (
  id             serial primary key,
  label          text not null,
  detector       text not null,
  ocr            text not null,
  endpoint       text not null,
  det_threshold  real not null,
  ocr_threshold  real not null,
  max_bibs       int  not null,
  ocr_preprocess text not null,
  ai_commit      text,
  meta           jsonb,               -- full GET /meta of the endpoint at start
  concurrency    int  not null,
  events         uuid[],              -- null = every event
  started_at     timestamptz not null default now(),
  finished_at    timestamptz,
  status         text not null default 'running',  -- running | completed | aborted
  notes          text
);

-- One row per photo per run. `response` is the raw service reply.
create table if not exists eval.run_photos (
  run_id        int  not null references eval.runs(id) on delete cascade,
  photo_id      uuid not null,
  seq           int  not null,
  status        text not null,        -- ok | error
  error         text,
  http_ms       real,                 -- round trip seen by the script (network included)
  decode_ms     real,
  detection_ms  real,
  preprocess_ms real,
  ocr_ms        real,
  total_ms      real,
  container_id  text,
  request_seq   int,
  cold          boolean,              -- request_seq <= 3 on its container
  image_width   int,
  image_height  int,
  response      jsonb,
  created_at    timestamptz not null default now(),
  primary key (run_id, photo_id)
);
create index if not exists run_photos_photo_idx on eval.run_photos (photo_id);

create table if not exists eval.run_detections (
  run_id     int  not null references eval.runs(id) on delete cascade,
  photo_id   uuid not null,
  idx        int  not null,
  class_name text not null,
  confidence real not null,
  bbox       real[] not null,
  primary key (run_id, photo_id, idx)
);
create index if not exists run_detections_class_idx on eval.run_detections (run_id, class_name);

create table if not exists eval.run_bibs (
  run_id                  int  not null references eval.runs(id) on delete cascade,
  photo_id                uuid not null,
  idx                     int  not null,
  digits                  text not null,
  confidence              real,
  confidence_uncalibrated real,
  confidence_per_digit    real[],
  status                  text,
  rejection_reason        text,
  raw_ocr_text            text,
  bbox_source             real[],
  bbox_confidence         real,
  preprocessing_applied   text[],
  processing_ms           real,
  preprocess_ms           real,
  primary key (run_id, photo_id, idx)
);

-- Frozen reference: the bib numbers a human can read on each photo.
create table if not exists eval.ground_truth_bibs (
  photo_id  uuid not null,
  digits    text not null,
  source    text not null,             -- production | adjudication
  frozen_at timestamptz not null default now(),
  primary key (photo_id, digits)
);

-- Which photos are in the evaluation set and why not, when excluded.
create table if not exists eval.dataset_photos (
  photo_id               uuid primary key,
  event_id               uuid not null,
  included               boolean not null default true,
  exclusion_reason       text,
  bib_visible_unreadable boolean not null default false,
  frozen_at              timestamptz
);

-- Every change to the reference or the set after freezing, with its reason.
create table if not exists eval.audits (
  id       serial primary key,
  photo_id uuid not null,
  run_id   int,
  before   jsonb,
  after    jsonb,
  reason   text not null,
  at       timestamptz not null default now()
);
