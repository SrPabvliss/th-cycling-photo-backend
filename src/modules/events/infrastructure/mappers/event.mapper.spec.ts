import { toPublicListProjection } from './event.mapper'

describe('public projection owner name', () => {
  it('maps snap_public_name to ownerName on the list projection', () => {
    const record = {
      slug: 'ruta-andes',
      name: 'Ruta Andes',
      start_date: new Date('2026-01-01'),
      end_date: new Date('2026-01-02'),
      snap_public_name: 'Foto Andes',
      province: { name: 'Tungurahua' },
      canton: { name: 'Ambato' },
      _count: { photos: 12 },
      assets: [],
    }

    expect(toPublicListProjection(record as never).ownerName).toBe('Foto Andes')
  })
})
