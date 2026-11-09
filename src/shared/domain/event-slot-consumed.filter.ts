// A deleted event still holds its slot if it was ever used, closing the delete-refund loophole.
export const EVENT_SLOT_CONSUMED_FILTER = {
  OR: [{ deleted_at: null }, { photos_uploaded: { gt: 0 } }],
}
