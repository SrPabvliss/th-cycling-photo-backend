# Environment Configuration

> Updated: Sprint 5 (March 2026). Reflects all variables currently in .env.example.

## Overview

Environment variables are separated (not a single DATABASE_URL) and validated on startup via `@nestjs/config` + `class-validator`. Prisma receives the constructed DATABASE_URL from individual parts.

## All Variables

### App
| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `NODE_ENV` | string | — | `development` \| `test` \| `preview` \| `production` |
| `PORT` | number | 3000 | App port |

### Database (PostgreSQL 16)
| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `DB_HOST` | string | localhost | Database host |
| `DB_PORT` | number | 5498 | Database port (Docker Compose maps to 5498) |
| `DB_USER` | string | postgres | Database user |
| `DB_PASSWORD` | string | postgres | Database password |
| `DB_NAME` | string | cycling_photo_dev | Database name |
| `DB_SSL_MODE` | string | — | Optional: `require` for cloud databases |

DATABASE_URL is constructed: `postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}`

### Backblaze B2 (Storage)
| Variable | Type | Description |
|----------|------|-------------|
| `B2_APPLICATION_KEY_ID` | string | B2 application key ID |
| `B2_APPLICATION_KEY` | string | B2 application key (secret) |
| `B2_BUCKET_ID` | string | Target bucket ID |
| `B2_BUCKET_NAME` | string | Target bucket name |
| `B2_REGION` | string | Bucket region (e.g., us-west-004) |

### Cloudflare CDN
| Variable | Type | Description |
|----------|------|-------------|
| `CLOUDFLARE_CDN_URL` | string | Base CDN URL for serving images via Cloudflare |

### Voyage AI (Embeddings)
| Variable | Type | Description |
|----------|------|-------------|
| `VOYAGE_API_KEY` | string | API key for voyage-multimodal-3.5 embeddings |

### Redis (BullMQ queues)
| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `REDIS_HOST` | string | localhost | Redis host |
| `REDIS_PORT` | number | 6394 | Redis port (Docker Compose maps to 6394) |

### Auth (JWT)
| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `JWT_SECRET` | string | — | Secret for signing JWT tokens (change in production!) |
| `JWT_ACCESS_EXPIRATION_SECONDS` | number | 900 | Access token TTL (15 minutes) |
| `JWT_REFRESH_EXPIRY_DAYS` | number | 30 | Refresh token TTL (30 days) |
| `CORS_ORIGIN` | string | http://localhost:5173 | Allowed CORS origin (frontend URL) |

### Seed Data
| Variable | Type | Description |
|----------|------|-------------|
| `ADMIN_SEED_EMAIL` | string | Email for initial admin user created by seed |
| `ADMIN_SEED_PASSWORD` | string | Password for initial admin user |

## Sprint 6 Additions (anticipated)

These will be added when the commercial flow modules are implemented:
| Variable | Type | Description |
|----------|------|-------------|
| `WATERMARK_WORKER_BASE_URL` | string | Base URL for Cloudflare Watermark Worker (e.g., https://photos.domain.com/photos/watermarked) |
| `PREVIEW_LINK_DEFAULT_EXPIRY_DAYS` | number | Default expiration for preview links (7) |
| `DELIVERY_LINK_DEFAULT_EXPIRY_DAYS` | number | Default expiration for delivery links (7) |

## Files

| File | Git | Purpose |
|------|-----|---------|
| `.env.example` | ✓ Tracked | Template with all variables |
| `.env.development` | ✗ Ignored | Local dev values |
| `.env.test` | ✗ Ignored | Test environment |

## Docker Compose Ports

Dev Docker Compose maps non-standard ports to avoid conflicts:
- PostgreSQL: 5498 (not 5432)
- Redis: 6394 (not 6379)
