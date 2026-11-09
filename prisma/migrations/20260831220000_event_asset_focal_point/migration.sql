-- Covers are served through the Worker with `fit: cover`, which crops to the centre. On a portrait
-- photo that lands on wheels instead of the rider, so the organiser needs to say which part of the
-- image matters. Cloudflare takes that as `gravity: { x, y }` with both values in 0..1.
--
-- 0.5/0.5 is the centre, which is exactly what the crop already does, so existing rows keep their
-- current framing.
ALTER TABLE "event_assets"
    ADD COLUMN "focal_x" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    ADD COLUMN "focal_y" DOUBLE PRECISION NOT NULL DEFAULT 0.5;
