import type { OrderItemDeliveredAs } from '@generated/prisma/client'

export type DeliveredFileInput = {
  deliveredAs: OrderItemDeliveredAs | null
  storageKey: string
  retouchedStorageKey: string | null
  fileSize: bigint | number
  retouchedFileSize: bigint | number | null
  publicSlug: string
  retouchedPublicSlug: string | null
}

export type DeliveredFile = {
  storageKey: string
  fileSize: number
  /**
   * CDN slug of the very file that is delivered, or null when that file was never given one. The
   * other version's slug is never borrowed: it would show a different image than the download.
   */
  publicSlug: string | null
}

export function resolveDeliveredFile(item: DeliveredFileInput): DeliveredFile {
  const wantsRetouched = item.deliveredAs === 'retouched' || item.deliveredAs === null
  const useRetouched = wantsRetouched && item.retouchedStorageKey !== null

  if (useRetouched) {
    return {
      storageKey: item.retouchedStorageKey as string,
      fileSize: Number(item.retouchedFileSize ?? item.fileSize),
      publicSlug: item.retouchedPublicSlug,
    }
  }

  return {
    storageKey: item.storageKey,
    fileSize: Number(item.fileSize),
    publicSlug: item.publicSlug,
  }
}
