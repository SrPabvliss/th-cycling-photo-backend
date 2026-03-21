# ADR-004: Watermark Strategy — Cloudflare Workers

> Summary for Claude Code. Full ADR in claude.ai project knowledge.

## Decision

Watermarks are applied ON-THE-FLY by Cloudflare Workers using `cf.image.draw`, NOT by the backend. The backend only constructs the correct URL — it never touches image bytes.

## Architecture: Two Workers

**Watermark Worker** (`/photos/watermarked/*`)
- Intercepts image requests at Cloudflare edge
- Fetches original from B2, applies overlays via `cf.image.draw` array
- Two overlays: static logo PNG (bottom-right) + dynamic QR (bottom-left)
- Results auto-cached at edge (24h TTL)
- Via header check (`/image-resizing/`) prevents infinite loops

**QR Helper Worker** (`/internal/qr?url=...`)
- Generates QR code PNG in memory using `qr-image` library
- Returns PNG with 1-year cache TTL
- QR encodes the public URL — acts as acquisition channel when photos are shared
- No storage — purely ephemeral

## How Backend Constructs Watermarked URLs

When returning photo URLs for preview links (public endpoints), the backend MUST return Worker URLs, NOT direct B2 URLs:

```
// WRONG — direct B2
https://f000.backblazeb2.com/file/bucket/events/event1/photo123.jpg

// CORRECT — via Watermark Worker
https://photos.domain.com/photos/watermarked/events/event1/photo123.jpg
```

This is the ONLY backend responsibility for watermarking. The construction pattern:
`WATERMARK_WORKER_BASE_URL + photo.storage_key`

## Key Constraints

- Worker routes must be SPECIFIC paths (not /*) to avoid loops
- B2 hostname must be added as allowed origin in Cloudflare Dashboard → Images → Sources
- The logo PNG must be publicly accessible (stored in B2 or any public URL)
- No text overlay natively — text must be pre-rendered as PNG
- Free tier: 5,000 unique transformations/month (sufficient for ~1,000 photos/month)

## Environment Variables (Workers, NOT backend)

- `WATERMARK_URL` — URL to static logo PNG
- `WATERMARK_OPACITY` — 0.0 to 1.0 (default 0.6)
- `B2_ORIGIN_HOST` — B2 hostname (e.g., f000.backblazeb2.com)
- `B2_BUCKET` — bucket name
- `DEFAULT_QUALITY` — JPEG quality (default 85)
