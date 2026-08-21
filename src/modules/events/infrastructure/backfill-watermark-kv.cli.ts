import { NestFactory } from '@nestjs/core'
import { type IKvStorageAdapter, KV_STORAGE_ADAPTER } from '@shared/cloudflare/domain/ports'
import { PrismaService } from '@shared/infrastructure'
import { AppModule } from '../../../app.module'

async function backfillWatermarkKv() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] })
  const prisma = app.get(PrismaService)
  const kv = app.get<IKvStorageAdapter>(KV_STORAGE_ADAPTER)

  const events = await prisma.event.findMany({
    where: { snap_watermark_storage_key: { not: null } },
    select: { id: true, snap_watermark_storage_key: true },
  })

  const entries = events.map((event) => ({
    key: `wm-${event.id}`,
    value: event.snap_watermark_storage_key as string,
  }))

  await kv.writeBulk(entries)
  console.log(`Backfilled ${entries.length} watermark KV entries`)

  await app.close()
}

backfillWatermarkKv().catch((err) => {
  console.error(err)
  process.exit(1)
})
