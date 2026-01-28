# BullMQ Setup

## Overview

BullMQ handles async job processing for photo classification pipeline.

## File Structure

```
src/modules/processing/
└── infrastructure/
    └── processors/
        └── photo-processing.processor.ts

src/shared/infrastructure/
└── queues/
    └── queue.module.ts       # Optional: shared queue config
```

---

## Module Configuration

```typescript
// processing.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';

import { PhotoProcessingProcessor } from './infrastructure/processors/photo-processing.processor';

@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.getOrThrow('REDIS_HOST'),
          port: config.getOrThrow('REDIS_PORT'),
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: 'photo-processing',
    }),
  ],
  providers: [PhotoProcessingProcessor],
})
export class ProcessingModule {}
```

---

## Processor Template

```typescript
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

interface PhotoProcessingJobData {
  photoId: string;
  eventId: string;
  requestId: string;
}

@Processor('photo-processing')
export class PhotoProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(PhotoProcessingProcessor.name);

  async process(job: Job<PhotoProcessingJobData>): Promise<void> {
    this.logger.log(`Processing photo ${job.data.photoId}`, {
      requestId: job.data.requestId,
    });

    try {
      // 1. Object detection (Roboflow)
      await this.detectObjects(job.data.photoId);
      await job.updateProgress(33);

      // 2. OCR (Google Vision)
      await this.extractText(job.data.photoId);
      await job.updateProgress(66);

      // 3. Color analysis (Clarifai)
      await this.analyzeColors(job.data.photoId);
      await job.updateProgress(100);

    } catch (error) {
      this.logger.error(`Failed to process photo ${job.data.photoId}`, error);
      throw error; // Re-throw to trigger retry
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<PhotoProcessingJobData>) {
    this.logger.log(`Job ${job.id} completed for photo ${job.data.photoId}`);
    // Emit WebSocket event for real-time progress
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<PhotoProcessingJobData>, error: Error) {
    this.logger.error(`Job ${job.id} failed: ${error.message}`);
    // Emit WebSocket event for failure notification
  }

  private async detectObjects(photoId: string): Promise<void> {
    // Implementation
  }

  private async extractText(photoId: string): Promise<void> {
    // Implementation
  }

  private async analyzeColors(photoId: string): Promise<void> {
    // Implementation
  }
}
```

---

## Adding Jobs to Queue

```typescript
import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class PhotoService {
  constructor(
    @InjectQueue('photo-processing')
    private readonly processingQueue: Queue,
  ) {}

  async queuePhotoForProcessing(
    photoId: string,
    eventId: string,
    requestId: string,
  ): Promise<void> {
    await this.processingQueue.add(
      'process-photo',
      { photoId, eventId, requestId },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  }

  async queueBatch(
    photos: { id: string; eventId: string }[],
    requestId: string,
  ): Promise<void> {
    const jobs = photos.map((photo) => ({
      name: 'process-photo',
      data: {
        photoId: photo.id,
        eventId: photo.eventId,
        requestId,
      },
    }));

    await this.processingQueue.addBulk(jobs);
  }
}
```

---

## Job Options

| Option | Description | Example |
|--------|-------------|---------|
| `attempts` | Retry count | `3` |
| `backoff` | Retry delay strategy | `{ type: 'exponential', delay: 1000 }` |
| `delay` | Initial delay (ms) | `5000` |
| `priority` | Lower = higher priority | `1` |
| `removeOnComplete` | Auto-cleanup | `true` |
| `removeOnFail` | Keep failed for inspection | `false` |

---

## Progress Tracking

```typescript
// In processor
await job.updateProgress(50);

// In service (listening)
const job = await this.processingQueue.getJob(jobId);
const progress = job?.progress;
```

---

## Queue Events for WebSocket

```typescript
import { QueueEvents } from 'bullmq';

const queueEvents = new QueueEvents('photo-processing');

queueEvents.on('progress', ({ jobId, data }) => {
  // Emit to WebSocket
  this.progressGateway.emitProgress(jobId, data);
});

queueEvents.on('completed', ({ jobId }) => {
  this.progressGateway.emitCompleted(jobId);
});

queueEvents.on('failed', ({ jobId, failedReason }) => {
  this.progressGateway.emitFailed(jobId, failedReason);
});
```

---

## Environment Variables

```env
REDIS_HOST=localhost
REDIS_PORT=6379
```

---

## See Also

- `infrastructure/websockets-setup.md` - Real-time progress updates
- `patterns/repositories.md` - Updating entities after processing
- `conventions/error-handling.md` - Job failure handling
