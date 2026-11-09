import type { OrderItemDeliveredAs } from '@generated/prisma/client'

export type DeliveredFileInput = {
  deliveredAs: OrderItemDeliveredAs | null
  storageKey: string
  retouchedStorageKey: string | null
  fileSize: bigint | number
  retouchedFileSize: bigint | number | null
}

export type DeliveredFile = {
  storageKey: string
  fileSize: number
}

export function resolveDeliveredFile(item: DeliveredFileInput): DeliveredFile {
  const wantsRetouched = item.deliveredAs === 'retouched' || item.deliveredAs === null
  const useRetouched = wantsRetouched && item.retouchedStorageKey !== null

  if (useRetouched) {
    return {
      storageKey: item.retouchedStorageKey as string,
      fileSize: Number(item.retouchedFileSize ?? item.fileSize),
    }
  }

  return { storageKey: item.storageKey, fileSize: Number(item.fileSize) }
}
