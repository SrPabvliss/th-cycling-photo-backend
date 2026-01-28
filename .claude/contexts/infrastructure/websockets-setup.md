# WebSockets Setup

## Overview

WebSockets provide real-time progress updates during photo processing.

## File Structure

```
src/shared/websockets/
├── progress.gateway.ts
└── websockets.module.ts
```

---

## Gateway Template

```typescript
// shared/websockets/progress.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*', // Configure properly for production
  },
  namespace: '/progress',
})
export class ProgressGateway {
  private readonly logger = new Logger(ProgressGateway.name);

  @WebSocketServer()
  server: Server;

  // Client subscribes to event progress
  @SubscribeMessage('subscribe:event')
  handleSubscribeEvent(
    @MessageBody() data: { eventId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = `event:${data.eventId}`;
    client.join(room);
    this.logger.log(`Client ${client.id} subscribed to ${room}`);
    return { success: true, room };
  }

  // Client unsubscribes from event
  @SubscribeMessage('unsubscribe:event')
  handleUnsubscribeEvent(
    @MessageBody() data: { eventId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = `event:${data.eventId}`;
    client.leave(room);
    return { success: true };
  }

  // ─────────────────────────────────────────────
  // Methods called by processors/services
  // ─────────────────────────────────────────────

  emitPhotoProgress(eventId: string, data: PhotoProgressPayload) {
    this.server.to(`event:${eventId}`).emit('photo:progress', data);
  }

  emitPhotoCompleted(eventId: string, data: PhotoCompletedPayload) {
    this.server.to(`event:${eventId}`).emit('photo:completed', data);
  }

  emitPhotoFailed(eventId: string, data: PhotoFailedPayload) {
    this.server.to(`event:${eventId}`).emit('photo:failed', data);
  }

  emitEventProgress(eventId: string, data: EventProgressPayload) {
    this.server.to(`event:${eventId}`).emit('event:progress', data);
  }

  emitEventCompleted(eventId: string, data: EventCompletedPayload) {
    this.server.to(`event:${eventId}`).emit('event:completed', data);
  }
}

// ─────────────────────────────────────────────
// Payload types
// ─────────────────────────────────────────────

interface PhotoProgressPayload {
  photoId: string;
  progress: number;
  stage: 'detection' | 'ocr' | 'color';
  requestId: string;
}

interface PhotoCompletedPayload {
  photoId: string;
  plateNumber: number | null;
  confidence: number;
  requestId: string;
}

interface PhotoFailedPayload {
  photoId: string;
  error: string;
  requestId: string;
}

interface EventProgressPayload {
  eventId: string;
  processedPhotos: number;
  totalPhotos: number;
  requestId: string;
}

interface EventCompletedPayload {
  eventId: string;
  summary: {
    total: number;
    succeeded: number;
    failed: number;
  };
  requestId: string;
}
```

---

## Module Setup

```typescript
// shared/websockets/websockets.module.ts
import { Module, Global } from '@nestjs/common';
import { ProgressGateway } from './progress.gateway';

@Global()
@Module({
  providers: [ProgressGateway],
  exports: [ProgressGateway],
})
export class WebSocketsModule {}
```

---

## Usage from Processor

```typescript
// processing.processor.ts
import { ProgressGateway } from '@/shared/websockets/progress.gateway';

@Processor('photo-processing')
export class PhotoProcessingProcessor extends WorkerHost {
  constructor(private readonly progressGateway: ProgressGateway) {
    super();
  }

  async process(job: Job<PhotoProcessingJobData>): Promise<void> {
    const { photoId, eventId, requestId } = job.data;

    // Emit progress during processing
    this.progressGateway.emitPhotoProgress(eventId, {
      photoId,
      progress: 33,
      stage: 'detection',
      requestId,
    });

    // ... processing logic

    // Emit completion
    this.progressGateway.emitPhotoCompleted(eventId, {
      photoId,
      plateNumber: 127,
      confidence: 0.94,
      requestId,
    });
  }
}
```

---

## Correlation ID Propagation

Always include `requestId` in WebSocket payloads for tracing:

```
HTTP Request (requestId: req_abc123)
    ↓
Controller → Queue Job
    ↓
BullMQ Worker (job.data.requestId: req_abc123)
    ↓
WebSocket Event (payload.requestId: req_abc123)
```

---

## See Also

- `infrastructure/bullmq-setup.md` - Job processing
- `conventions/http-responses.md` - Request ID correlation
