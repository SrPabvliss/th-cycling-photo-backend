import { resolveDeliveredFile } from './delivered-file.resolver'

const BASE = {
  storageKey: 'events/e1/photos/a.jpg',
  retouchedStorageKey: 'events/e1/retouched/a.jpg',
  fileSize: 1000n,
  retouchedFileSize: 2000n,
  publicSlug: 'slug-original',
  retouchedPublicSlug: 'slug-retouched',
}

describe('resolveDeliveredFile', () => {
  it('returns the retouched file when the item was delivered as retouched', () => {
    expect(resolveDeliveredFile({ ...BASE, deliveredAs: 'retouched' })).toEqual({
      storageKey: 'events/e1/retouched/a.jpg',
      fileSize: 2000,
      publicSlug: 'slug-retouched',
    })
  })

  it('returns the original file when the item was delivered as original', () => {
    expect(resolveDeliveredFile({ ...BASE, deliveredAs: 'original' })).toEqual({
      storageKey: 'events/e1/photos/a.jpg',
      fileSize: 1000,
      publicSlug: 'slug-original',
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
    ).toEqual({
      storageKey: 'events/e1/photos/a.jpg',
      fileSize: 1000,
      publicSlug: 'slug-original',
    })
  })

  it('falls back to the retouched file when delivered_as is null and one exists', () => {
    expect(resolveDeliveredFile({ ...BASE, deliveredAs: null })).toEqual({
      storageKey: 'events/e1/retouched/a.jpg',
      fileSize: 2000,
      publicSlug: 'slug-retouched',
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
    ).toEqual({
      storageKey: 'events/e1/photos/a.jpg',
      fileSize: 1000,
      publicSlug: 'slug-original',
    })
  })

  it('uses the original size when the retouched size is missing', () => {
    expect(
      resolveDeliveredFile({ ...BASE, deliveredAs: 'retouched', retouchedFileSize: null }),
    ).toEqual({
      storageKey: 'events/e1/retouched/a.jpg',
      fileSize: 1000,
      publicSlug: 'slug-retouched',
    })
  })

  it('gives no slug when the retouched file is delivered but was never given one', () => {
    expect(
      resolveDeliveredFile({ ...BASE, deliveredAs: 'retouched', retouchedPublicSlug: null }),
    ).toEqual({
      storageKey: 'events/e1/retouched/a.jpg',
      fileSize: 2000,
      publicSlug: null,
    })
  })

  it('never borrows the retouched slug for an original delivery', () => {
    expect(resolveDeliveredFile({ ...BASE, deliveredAs: 'original' }).publicSlug).toBe(
      'slug-original',
    )
  })
})
