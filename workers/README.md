# Cloudflare Workers — Watermark + QR

Two Workers that apply watermark overlays to cycling photos served from B2.

## Architecture

```
Browser requests watermarked photo
    → CDN_DOMAIN/photos/watermarked/events/xxx/photo.jpg
    → Watermark Worker intercepts
    → Fetches original from B2 origin (direct, not through CDN)
    → Applies logo overlay (bottom-right) + QR code overlay (bottom-left)
    → Reduces quality for preview protection
    → Cloudflare caches result for 24h
    → Returns watermarked image
```

No copies are created. Everything happens in memory at Cloudflare's edge.

## Prerequisites

1. **Domain in Cloudflare**: your domain must be an active zone
2. **CDN subdomain**: must be proxied (orange cloud) through Cloudflare
3. **Watermark PNG**: uploaded to B2 (e.g., `assets/sample_watermark.png`)
4. **Node.js 18+** installed locally
5. **Wrangler CLI** installed: `npm install -g wrangler`

## Environment Variables

Both Workers use `.dev.vars` files for local development (gitignored) and Cloudflare secrets for production. See `.dev.vars.example` in each Worker directory for the required variables.

### Watermark Worker secrets

| Variable | Description |
|---|---|
| `B2_ORIGIN_HOST` | B2 S3-compatible hostname |
| `B2_BUCKET` | B2 bucket name |
| `WATERMARK_URL` | Public URL to watermark PNG |
| `WATERMARK_OPACITY` | Logo opacity (0.0 - 1.0) |
| `DEFAULT_QUALITY` | Output JPEG quality (1-100) |
| `QR_WORKER_HOST` | QR Worker custom domain |
| `PUBLIC_DOMAIN` | Public CDN domain for photo URLs |

### QR Worker secrets

| Variable | Description |
|---|---|
| `ALLOWED_DOMAINS` | Comma-separated list of allowed domains for QR generation |

### Setting secrets for production

```bash
# For each variable:
cd workers/watermark-worker
wrangler secret put B2_ORIGIN_HOST
# (prompts for value, stored encrypted in Cloudflare)

cd workers/qr-worker
wrangler secret put ALLOWED_DOMAINS
```

## Step 1: Enable Image Transforms

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Select your zone
3. Go to **Images** → **Transformations**
4. Click **Enable transformations**
5. Under **Allowed origins**, add your B2 hostname (the `B2_ORIGIN_HOST` value)

> This is FREE — 5,000 unique transformations/month included.

## Step 2: Authenticate Wrangler

```bash
wrangler login
```

This opens a browser for OAuth. Authorize Wrangler to access your Cloudflare account.

## Step 3: Deploy QR Worker

The QR Worker must be deployed FIRST because the Watermark Worker references it.

```bash
cd workers/qr-worker
npm install
wrangler deploy
```

Wrangler will automatically create the custom domain (DNS record added for you).

**Set production secrets:**
```bash
wrangler secret put ALLOWED_DOMAINS
# Enter: your-cdn-domain.com,your-domain.com
```

**Test it:**
```bash
curl "https://YOUR_QR_DOMAIN/?url=https://your-cdn-domain.com/test"
```

You should get an SVG QR code back.

## Step 4: Deploy Watermark Worker

```bash
cd workers/watermark-worker
npm install
npm install
wrangler deploy
```

**Set production secrets:**
```bash
wrangler secret put B2_ORIGIN_HOST
wrangler secret put B2_BUCKET
wrangler secret put WATERMARK_URL
wrangler secret put WATERMARK_OPACITY
wrangler secret put DEFAULT_QUALITY
wrangler secret put QR_WORKER_HOST
wrangler secret put PUBLIC_DOMAIN
```

**Test it:**

Open in browser:
```
https://YOUR_CDN_DOMAIN/photos/watermarked/events/{EVENT_ID}/photos/{FILENAME}.jpg
```

Replace `{EVENT_ID}` and `{FILENAME}` with a real photo from your B2 bucket.

You should see the photo with:
- Logo watermark in the bottom-right corner
- QR code in the bottom-left corner
- Reduced quality

## Step 5: Configure WAF Rule (protect originals)

This prevents external users from accessing original photos directly via the CDN.

1. Go to Cloudflare Dashboard → your zone
2. **Security** → **WAF** → **Custom rules** → **Create rule**
3. Configure:
   - **Rule name**: `Block direct photo access`
   - **Field**: URI Path
   - **Operator**: contains
   - **Value**: `/file/YOUR_BUCKET/events/`
   - **Action**: Block
4. Click **Deploy**

This blocks external access to original photos. The Watermark Worker bypasses this because it fetches directly from B2 origin (not through the CDN domain).

> Admin access to originals: your NestJS backend can generate presigned B2 URLs that go directly to B2, not through the CDN.

## QR Code Spike

The QR overlay uses `qrcode-svg` which generates SVG. Cloudflare Image Transforms can use SVGs as overlays but does not resize them. The QR is generated at the exact target dimensions (150x150px) to avoid resizing issues.

**Test scannability:**
1. Open a watermarked photo in your browser
2. Try scanning the QR with your phone camera
3. It should open the watermarked photo URL

**If the QR doesn't render or isn't scannable:**
- Check if the QR Worker is responding: `curl "https://YOUR_QR_DOMAIN/?url=https://example.com"`
- Try changing the QR size parameter in `watermark-worker/src/index.js`
- If SVG overlays don't work with Image Transforms, replace `qrcode-svg` with `@juit/qrcode` (PNG output)

## Production Deployment

When moving to production:

1. Update secrets via `wrangler secret put` with production values
2. Update route patterns in `wrangler.toml` if domain changes
3. Update the WAF rule to include the production bucket path
4. Consider using [Wrangler environments](https://developers.cloudflare.com/workers/wrangler/environments/) for dev/prod separation

## Costs

| Service | Free Tier | Typical Usage (~1,000 photos/month) |
|---|---|---|
| Workers | 100,000 requests/day | Well within limits |
| Image Transforms | 5,000 unique transforms/month | ~1,000 unique transforms |
| Custom Domains | Unlimited | 1 |
| **Total** | | **$0/month** |

## Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| Error 9422 | Image Transforms not enabled | Enable in Dashboard → Images → Transformations |
| Error 9419 | B2 origin not in allowed sources | Add B2 hostname in Images → Sources |
| Error 1042 | Worker trying to fetch from same zone route | Shouldn't happen — Workers fetch directly from B2 |
| Error 1019 | Infinite loop detected | Check Via header logic in watermark-worker |
| Photo serves without watermark | Transform failed, fallback activated | Check Worker logs: `wrangler tail watermark-worker` |
| QR not rendering | SVG overlay issue | See QR Code Spike section above |
