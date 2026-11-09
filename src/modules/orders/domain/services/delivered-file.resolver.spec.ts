import { resolveDeliveredFile } from './delivered-file.resolver'

const BASE = {
  storageKey: 'events/e1/photos/a.jpg',
  retouchedStorageKey: 'events/e1/retouched/a.jpg',
  fileSize: 1000n,
  retouchedFileSize: 2000n,
}

describe('resolveDeliveredFile', () => {
  it('returns the retouched file when the item was delivered as retouched', () => {
    expect(resolveDeliveredFile({ ...BASE, deliveredAs: 'retouched' })).toEqual({
      storageKey: 'events/e1/retouched/a.jpg',
      fileSize: 2000,
    })
  })

  it('returns the original file when the item was delivered as original', () => {
    expect(resolveDeliveredFile({ ...BASE, deliveredAs: 'original' })).toEqual({
      storageKey: 'events/e1/photos/a.jpg',
      fileSize: 1000,
    })
  })

  it('returns the original file when the item says retouched but no retouched key exists', () => {
    expect(
      resolveDeliveredFile({
        ...BASE,
        deliveredAs: 'retouched',
        retouchedStorageKey: null,
        retouchedFileSize: null,
      }),
    ).toEqual({ storageKey: 'events/e1/photos/a.jpg', fileSize: 1000 })
  })

  it('falls back to the retouched file when delivered_as is null and one exists', () => {
    expect(resolveDeliveredFile({ ...BASE, deliveredAs: null })).toEqual({
      storageKey: 'events/e1/retouched/a.jpg',
      fileSize: 2000,
    })
  })

  it('falls back to the original file when delivered_as is null and none exists', () => {
    expect(
      resolveDeliveredFile({
        ...BASE,
        deliveredAs: null,
        retouchedStorageKey: null,
        retouchedFileSize: null,
      }),
    ).toEqual({ storageKey: 'events/e1/photos/a.jpg', fileSize: 1000 })
  })

  it('uses the original size when the retouched size is missing', () => {
    expect(
      resolveDeliveredFile({ ...BASE, deliveredAs: 'retouched', retouchedFileSize: null }),
    ).toEqual({ storageKey: 'events/e1/retouched/a.jpg', fileSize: 1000 })
  })
})
