# WebSockets Setup

> Updated: Sprint 6 planning (March 2026).
> Two WebSocket use cases exist in this project: notifications (Sprint 6) and processing progress (Sprint 9).

## Overview

WebSockets use Socket.io 4.x via `@nestjs/platform-socket.io`. Two separate gateways serve different purposes:

1. **NotificationsGateway** (Sprint 6) — commercial flow events pushed to admin users
2. **ProgressGateway** (Sprint 9) — real-time photo processing progress

## 1. Notifications Gateway (Sprint 6 — Commercial Flow)

### Architecture

```
src/shared/notifications/
├── notifications.gateway.ts    # WebSocket gateway
├── notifications.service.ts    # Injectable service for emitting events
└── notifications.module.ts     # Global module
```

### Namespace: `/notifications`

Authentication required — JWT validated in `handleConnection` lifecycle hook. Only admin users receive notifications. Unauthenticated connections are rejected immediately.

### Events

| Event | Trigger | Payload |
|-------|---------|---------|
| `preview:viewed` | Client opens preview link (first time) | `{ previewLinkId, eventName, photoCount, viewedAt }` |
| `order:created` | Client submits order from preview | `{ orderId, eventName, customerName, photoCount, createdAt }` |
| `order:paid` | Admin confirms payment | `{ orderId, eventName, customerName, confirmedBy, paidAt }` |

### Usage from Other Modules

Other modules inject `NotificationsService` and call `emit(event, payload)`:

```typescript
// In PreviewLinks handler:
this.notificationsService.emit('preview:viewed', {
  previewLinkId: preview.id,
  eventName: event.name,
  photoCount: preview.photos.length,
  viewedAt: new Date(),
});
```

### Authentication Pattern

```typescript
@WebSocketGateway({ namespace: '/notifications', cors: { origin: CORS_ORIGIN, credentials: true } })
export class NotificationsGateway implements OnGatewayConnection {
  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token;
      const payload = this.jwtService.verify(token);
      // Verify user is admin
      // If not admin, disconnect
    } catch {
      client.disconnect(true);
    }
  }
}
```

## 2. Progress Gateway (Sprint 9 — IA Processing) — PLANNED

> ⚠️ NOT YET IMPLEMENTED. This section documents the planned architecture.

### Namespace: `/progress`

Room-based — clients subscribe to specific event processing rooms.

### Events (planned)

| Event | Description |
|-------|-------------|
| `photo:progress` | Per-photo processing stage update (detection → OCR → color) |
| `photo:completed` | Photo fully processed with results |
| `photo:failed` | Photo processing failed |
| `event:progress` | Aggregate progress (47/500 photos processed) |
| `event:completed` | All photos in event processed |

### Room Pattern

```
Client subscribes to → room: `event:{eventId}`
Server emits to → that room only
```

## Dependencies

```bash
# Already in package.json for NestJS
@nestjs/platform-socket.io
@nestjs/websockets

# Client (frontend)
socket.io-client
```

## CORS Configuration

WebSocket CORS must match the HTTP CORS origin. Both read from `CORS_ORIGIN` env variable. Credentials (cookies) must be enabled for JWT cookie forwarding if applicable.

## Key Differences Between Gateways

| Aspect | Notifications (Sprint 6) | Progress (Sprint 9) |
|--------|-------------------------|---------------------|
| Namespace | `/notifications` | `/progress` |
| Auth | JWT required (admin only) | JWT required (any role) |
| Rooms | No rooms (broadcast to all admins) | Room per event |
| Direction | Server → admin clients only | Server → subscribed clients |
| State | Stateless (no server-side state) | Tracks processing jobs |

## See Also

- `project_docs/ADR-005-commercial-flow-model.md` — WebSocket events for commercial flow
- `infrastructure/bullmq-setup.md` — Job processing (Sprint 9 will connect BullMQ → Progress Gateway)
