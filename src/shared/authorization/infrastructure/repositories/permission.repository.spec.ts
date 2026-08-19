import type { PrismaService } from '@shared/infrastructure/prisma/prisma.service'
import { PermissionRepository } from './permission.repository'

// Covers the shaping logic in `PermissionRepository.load()` with a mocked client: the global/event
// grant split, per-event Map accumulation, and collaboratorEventIds mapping, none of which the
// seeded users exercise. The integration spec proves the query itself against the real schema.
describe('PermissionRepository.load (grant shaping)', () => {
  let prisma: any
  let repo: PermissionRepository

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
      },
    }
    repo = new PermissionRepository(prisma as PrismaService)
  })

  it('returns EMPTY_PRINCIPAL_PERMISSIONS() when the user does not exist', async () => {
    prisma.user.findUnique.mockResolvedValue(null)

    const p = await repo.load('unknown-user')

    expect(p.templateKeys.size).toBe(0)
    expect(p.globalGrants.size).toBe(0)
    expect(p.eventGrants.size).toBe(0)
    expect(p.tenantId).toBeNull()
    expect(p.isPlatform).toBe(false)
    expect(p.collaboratorEventIds).toEqual([])
  })

  it('splits grants into globalGrants and eventGrants, accumulates two grants on the same event, and maps collaboratorEventIds', async () => {
    prisma.user.findUnique.mockResolvedValue({
      tenant_id: 'tenant-1',
      tenant: { is_platform: false },
      permission_template: {
        permissions: [{ permission: { key: 'event.read' } }],
      },
      permission_grants: [
        // global grant
        {
          scope_type: 'global',
          event_id: null,
          effect: 'allow',
          permission: { key: 'order.gift' },
        },
        // two event-scoped grants on the SAME event — both must survive
        {
          scope_type: 'event',
          event_id: 'event-1',
          effect: 'allow',
          permission: { key: 'photo.delete' },
        },
        {
          scope_type: 'event',
          event_id: 'event-1',
          effect: 'deny',
          permission: { key: 'photo.review' },
        },
        // event-scoped grant on a different event
        {
          scope_type: 'event',
          event_id: 'event-2',
          effect: 'deny',
          permission: { key: 'order.cancel' },
        },
        // non-catalog key — must be skipped rather than throwing
        {
          scope_type: 'global',
          event_id: null,
          effect: 'allow',
          permission: { key: 'not.a.real.permission' },
        },
      ],
      assigned_events: [{ event_id: 'event-1' }, { event_id: 'event-3' }],
    })

    const p = await repo.load('user-1')

    expect(p.tenantId).toBe('tenant-1')
    expect(p.isPlatform).toBe(false)
    expect(p.templateKeys.has('event.read')).toBe(true)

    // global grant — and the non-catalog key was skipped, not added
    expect(p.globalGrants.get('order.gift')).toBe('allow')
    expect(p.globalGrants.size).toBe(1)

    // two grants on the same event both survive
    expect(p.eventGrants.get('event-1')?.get('photo.delete')).toBe('allow')
    expect(p.eventGrants.get('event-1')?.get('photo.review')).toBe('deny')
    expect(p.eventGrants.get('event-1')?.size).toBe(2)

    // a different event's grant lands under its own key, not merged in
    expect(p.eventGrants.get('event-2')?.get('order.cancel')).toBe('deny')
    expect(p.eventGrants.size).toBe(2)

    // collaboratorEventIds mapped straight from assigned_events
    expect(p.collaboratorEventIds).toEqual(['event-1', 'event-3'])
  })
})
