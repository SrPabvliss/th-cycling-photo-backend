import { Processor, WorkerHost } from '@nestjs/bullmq'
import { CommandBus } from '@nestjs/cqrs'
import { ReapStalledPhotosCommand } from '@photos/application/commands/reap-stalled-photos/reap-stalled-photos.command'

export const PHOTO_PROCESSING_REAPER_QUEUE = 'photo-processing-reaper'

@Processor(PHOTO_PROCESSING_REAPER_QUEUE, { concurrency: 1 })
export class PhotoProcessingReaperProcessor extends WorkerHost {
  constructor(private readonly commandBus: CommandBus) {
    super()
  }

  async process(): Promise<void> {
    await this.commandBus.execute(new ReapStalledPhotosCommand(new Date()))
  }
}
