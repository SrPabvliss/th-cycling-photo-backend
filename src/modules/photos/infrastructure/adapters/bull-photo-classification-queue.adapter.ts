import { InjectQueue } from '@nestjs/bullmq'
import { Injectable } from '@nestjs/common'
import type { IPhotoClassificationQueue } from '@photos/domain/ports'
import type { Queue } from 'bullmq'

@Injectable()
export class BullPhotoClassificationQueue implements IPhotoClassificationQueue {
  static readonly LIVE_STATES = ['active', 'waiting', 'delayed', 'prioritized'] as const

  constructor(@InjectQueue('photo-classification') private readonly queue: Queue) {}

  async enqueue(photoIds: string[]): Promise<void> {
    if (photoIds.length === 0) return
    await this.queue.addBulk(
      photoIds.map((photoId) => ({
        name: 'classify-photo',
        data: { photoId },
        opts: { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
      })),
    )
  }

  async getLivePhotoIds(): Promise<Set<string>> {
    const jobs = await this.queue.getJobs([...BullPhotoClassificationQueue.LIVE_STATES])
    return new Set(
      jobs
        .map((job) => job?.data?.photoId)
        .filter((photoId): photoId is string => typeof photoId === 'string'),
    )
  }
}
