# ADR-005: Commercial Flow Data Model

> Summary for Claude Code. Full ADR in claude.ai project knowledge.

## Overview

Four new entities model the commercial flow: Customer → Order ← PreviewLink → DeliveryLink. No price/payment management — Titan TV handles that externally via WhatsApp.

## New Entities

### Customer
- `id`, `first_name`, `last_name`, `whatsapp`, `email?`, `created_at`
- NOT a User (no login, no roles) — just a contact record
- Find-or-create by WhatsApp: same number = same customer
- Indexes: whatsapp, email

### PreviewLink
- `id`, `token` (64 hex chars, crypto.randomBytes), `event_id`, `status`, `expires_at`, `viewed_at`, `created_at`, `created_by_id`
- Status: `active` → `expired` (expires_at passed) | `converted` (order created)
- Photos via join table `PreviewLinkPhoto` (preview_link_id, photo_id)
- Public route: GET /preview/:token (no auth, @Public)
- Token: `crypto.randomBytes(32).toString('hex')` — NOT UUID

### Order
- `id`, `preview_link_id`, `event_id`, `customer_id`, `status`, `notes?`, `created_at`, `paid_at`, `delivered_at`, `cancelled_at`, `confirmed_by_id`
- Status: `pending` → `paid` → `delivered` (paid+delivered in same transaction) | `cancelled`
- Photos via join table `OrderPhoto` (order_id, photo_id) — subset of preview photos
- Public endpoint: POST /preview/:token/orders (creates order + find-or-create customer)

### DeliveryLink
- `id`, `order_id` (unique — 1:1), `token` (64 hex), `status`, `expires_at`, `first_downloaded_at`, `download_count`, `created_at`
- Status: `active` → `downloaded` (first access) → `expired` (expires_at)
- Auto-generated when admin confirms payment (same transaction)
- Public route: GET /delivery/:token — returns presigned B2 URLs (1h expiry per URL)

## State Transitions

```
PreviewLink: active → expired | converted
Order:       pending → paid → delivered | cancelled
DeliveryLink: active → downloaded → expired
```

## Modifications to Existing Models

- Photo: add `preview_link_photos PreviewLinkPhoto[]` and `order_photos OrderPhoto[]`
- Event: add `preview_links PreviewLink[]` and `orders Order[]`
- User: add `preview_links_created @relation("PreviewLinkCreatedBy")` and `orders_confirmed @relation("OrderConfirmedBy")`

## WhatsApp URL Generation

Build `https://wa.me/{phone}?text={encodeURIComponent(message)}` with templates:

1. **Share preview**: "¡Hola! 👋 Soy de Titan TV. Encontramos {photo_count} fotos tuyas del evento "{event_name}". Revísalas aquí: {preview_link}..."
2. **Coordinate payment**: "¡Hola {customer_first_name}! 👋 Recibimos tu selección de {photo_count} fotos del evento "{event_name}"..."
3. **Send delivery**: "¡Hola {customer_first_name}! ✅ Tu pago fue confirmado. Aquí tienes tus {photo_count} fotos: {delivery_link}..."

Templates are NOT stored in DB — implemented as config/utility in the backend.

## WebSocket Events (via NotificationsService)

- `preview:viewed` — first time client opens preview link
- `order:created` — client submits order from preview
- `order:paid` — admin confirms payment

Only emitted to authenticated admin users via /notifications namespace.

## Security Notes (Sprint 6 scope)

- Tokens: crypto.randomBytes(32) — 64 hex chars, not UUIDs
- Presigned B2 URLs: 1h expiry, regenerated on each delivery page access
- Expiration: lazy evaluation (check on access) + optional daily cron for metrics consistency
- Rate limiting and CORS hardening deferred to Sprint 8
