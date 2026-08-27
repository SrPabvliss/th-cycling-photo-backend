import type { CdnUrlBuilder } from '@shared/cloudflare/infrastructure'
import { toDetailProjection, toPublicListProjection } from './event.mapper'

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

describe('toDetailProjection — relational fields', () => {
  const cdn = { assetUrl: () => 'https://cdn.test/cover.jpg' } as unknown as CdnUrlBuilder

  function makeDetailRecord(overrides: Record<string, unknown> = {}) {
    return {
      id: 'e1',
      slug: 'vuelta-al-cotopaxi-2026',
      name: 'Vuelta al Cotopaxi 2026',
      start_date: new Date('2026-05-01'),
      end_date: new Date('2026-05-02'),
      province: { name: 'Cotopaxi' },
      canton: { name: 'Latacunga' },
      province_id: 5,
      canton_id: 50,
      status: 'active',
      is_frozen: false,
      frozen_at: null,
      photo_quota: 3000,
      photos_uploaded: 2428,
      created_at: new Date('2026-04-01'),
      updated_at: new Date('2026-04-02'),
      _count: { photos: 2428 },
      assets: [],
      tenant: { name: 'Andes Photo' },
      event_type: { name: 'Ruta' },
      contract: { commercial_name: 'Contrato 2026-A' },
      ...overrides,
    }
  }

  it('exposes the owning organizador, the event type and the contract', () => {
    const result = toDetailProjection(makeDetailRecord() as never, cdn)

    expect(result.organizerName).toBe('Andes Photo')
    expect(result.eventTypeName).toBe('Ruta')
    expect(result.contractName).toBe('Contrato 2026-A')
  })

  it('returns a null contract name when the event consumed no contract', () => {
    const result = toDetailProjection(makeDetailRecord({ contract: null }) as never, cdn)

    expect(result.contractName).toBeNull()
  })

  it('carries frozenAt through', () => {
    const frozenAt = new Date('2026-06-01T10:00:00Z')
    const result = toDetailProjection(
      makeDetailRecord({ is_frozen: true, frozen_at: frozenAt }) as never,
      cdn,
    )

    expect(result.frozenAt).toEqual(frozenAt)
  })
})
