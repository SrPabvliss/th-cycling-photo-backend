import { randomUUID } from 'node:crypto'
import { ConfigModule } from '@nestjs/config'
import { Test, type TestingModule } from '@nestjs/testing'
import { Pagination } from '@shared/application'
import { CdnUrlBuilder } from '@shared/cloudflare/infrastructure/cdn-url.builder'
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service'
import configuration from '../../../../config/configuration'
import { validate } from '../../../../config/env.validation'
import type {
  InvitationCardProjection,
  OrganizerCardProjection,
} from '../../application/projections/organizer-list.projection'
import { ORGANIZER_TABS } from '../../domain/ports/organizer-read-repository.port'
import { OrganizerReadRepository } from './organizer-read.repository'

const fakeCdn = {
  watermarkUrl: (tenantId: string, storageKey: string) =>
    `https://cdn.test/${tenantId}/${storageKey}`,
} as CdnUrlBuilder

describe('OrganizerReadRepository organizers SQL', () => {
  let module: TestingModule
  let prisma: PrismaService
  let repo: OrganizerReadRepository

  const runId = `orgs-it-${randomUUID().slice(0, 8)}`
  const email = (key: string) => `${runId}-${key}@example.com`

  const tenantIds: Record<string, string> = {}
  const userIds: Record<string, string> = {}
  const contractIds: Record<string, string> = {}
  const eventIds: string[] = []
  let platformTenantId: string

  const now = Date.now()
  const daysFromNow = (days: number) => new Date(now + days * 86_400_000)

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          envFilePath: [`.env.${process.env.NODE_ENV || 'development'}`, '.env'],
          validate,
          load: [configuration],
          isGlobal: true,
        }),
      ],
      providers: [PrismaService],
    }).compile()

    prisma = module.get(PrismaService)
    repo = new OrganizerReadRepository(prisma, fakeCdn)

    const eventType = await prisma.eventType.findFirstOrThrow()

    async function createTenant(
      key: string,
      name: string,
      overrides: { defaultEventPhotoQuota?: number } = {},
    ) {
      const tenant = await prisma.tenant.create({
        data: {
          name,
          is_platform: false,
          default_event_photo_quota: overrides.defaultEventPhotoQuota ?? null,
        },
      })
      tenantIds[key] = tenant.id
      const user = await prisma.user.create({
        data: {
          email: email(key),
          password_hash: 'x',
          first_name: 'Holder',
          last_name: key.toUpperCase(),
          tenant_id: tenant.id,
          email_verified_at: new Date(),
        },
      })
      userIds[key] = user.id
      return tenant.id
    }

    async function createUser(key: string) {
      const user = await prisma.user.create({
        data: { email: email(key), password_hash: 'x', first_name: 'Holder', last_name: key },
      })
      userIds[key] = user.id
      return user.id
    }

    async function createContract(
      key: string,
      data: {
        userKey: string
        tenantKey?: string
        commercialName: string
        eventsTotal: number
        photosPerEvent?: number | null
        validUntil: Date
        status: 'pending' | 'accepted' | 'revoked'
        acceptedAt?: Date | null
      },
    ) {
      const contract = await prisma.tenantContract.create({
        data: {
          user_id: userIds[data.userKey],
          tenant_id: data.tenantKey ? tenantIds[data.tenantKey] : null,
          commercial_name: data.commercialName,
          events_total: data.eventsTotal,
          photos_per_event: data.photosPerEvent ?? null,
          status: data.status,
          token_hash: `${runId}-${key}`.slice(0, 64),
          valid_until: data.validUntil,
          terms_version: '1.0',
          accepted_at: data.acceptedAt ?? null,
        },
      })
      contractIds[key] = contract.id
      return contract.id
    }

    async function createEvent(
      key: string,
      tenantKey: string,
      contractKey: string,
      overrides: {
        deletedAt?: Date
        photosUploaded?: number
        name?: string
        startDate?: Date
        photoQuota?: number | null
      } = {},
    ) {
      const startDate = overrides.startDate ?? new Date('2026-01-01')
      const endDate = new Date(startDate.getTime() + 86_400_000)
      const event = await prisma.event.create({
        data: {
          name: overrides.name ?? `Event ${runId} ${key}`,
          slug: `event-${runId}-${key}`,
          start_date: startDate,
          end_date: endDate,
          tenant_id: tenantIds[tenantKey],
          contract_id: contractIds[contractKey],
          event_type_id: eventType.id,
          deleted_at: overrides.deletedAt ?? null,
          photos_uploaded: overrides.photosUploaded ?? 0,
          photo_quota: overrides.photoQuota ?? null,
        },
      })
      eventIds.push(event.id)
    }

    await createTenant('a', 'Con dos contratos', { defaultEventPhotoQuota: 1500 })
    tenantIds.conDosContratos = tenantIds.a
    await createTenant('b', 'Sin cupo')
    await createTenant('c', 'Vencido')
    await createTenant('d', 'Por vencer')
    await createTenant('e', 'Limites distintos')
    await createUser('p')
    await createUser('r')
    await createUser('s')

    await createContract('a1', {
      userKey: 'a',
      tenantKey: 'a',
      commercialName: 'Con dos contratos',
      eventsTotal: 2,
      photosPerEvent: 100,
      validUntil: daysFromNow(-20),
      status: 'accepted',
      acceptedAt: daysFromNow(-400),
    })
    await createContract('a2', {
      userKey: 'a',
      tenantKey: 'a',
      commercialName: 'Con dos contratos',
      eventsTotal: 10,
      photosPerEvent: 3000,
      validUntil: daysFromNow(365),
      status: 'accepted',
      acceptedAt: daysFromNow(-30),
    })
    await createContract('b1', {
      userKey: 'b',
      tenantKey: 'b',
      commercialName: 'Sin cupo',
      eventsTotal: 2,
      photosPerEvent: 1000,
      validUntil: daysFromNow(365),
      status: 'accepted',
      acceptedAt: daysFromNow(-30),
    })
    await createContract('c1', {
      userKey: 'c',
      tenantKey: 'c',
      commercialName: 'Vencido',
      eventsTotal: 1,
      photosPerEvent: 1000,
      validUntil: daysFromNow(-5),
      status: 'accepted',
      acceptedAt: daysFromNow(-200),
    })
    await createContract('d1', {
      userKey: 'd',
      tenantKey: 'd',
      commercialName: 'Por vencer',
      eventsTotal: 5,
      photosPerEvent: 1000,
      validUntil: daysFromNow(10),
      status: 'accepted',
      acceptedAt: daysFromNow(-30),
    })
    await createContract('e1', {
      userKey: 'e',
      tenantKey: 'e',
      commercialName: 'Limites distintos',
      eventsTotal: 3,
      photosPerEvent: 500,
      validUntil: daysFromNow(300),
      status: 'accepted',
      acceptedAt: daysFromNow(-30),
    })
    await createContract('e2', {
      userKey: 'e',
      tenantKey: 'e',
      commercialName: 'Limites distintos',
      eventsTotal: 3,
      photosPerEvent: null,
      validUntil: daysFromNow(60),
      status: 'accepted',
      acceptedAt: daysFromNow(-10),
    })

    await createContract('p', {
      userKey: 'p',
      commercialName: 'P',
      eventsTotal: 4,
      photosPerEvent: 800,
      validUntil: daysFromNow(30),
      status: 'pending',
    })
    await createContract('q', {
      userKey: 'd',
      commercialName: 'Q',
      eventsTotal: 6,
      photosPerEvent: 900,
      validUntil: daysFromNow(20),
      status: 'pending',
    })
    await createContract('r', {
      userKey: 'r',
      commercialName: 'R',
      eventsTotal: 2,
      photosPerEvent: null,
      validUntil: daysFromNow(-3),
      status: 'pending',
    })
    await createContract('s', {
      userKey: 's',
      commercialName: 'S',
      eventsTotal: 2,
      photosPerEvent: null,
      validUntil: daysFromNow(30),
      status: 'revoked',
    })

    await createEvent('a-1', 'a', 'a2', {
      name: 'Copa Bike Parks',
      startDate: new Date('2026-01-01'),
      photoQuota: 500,
    })
    await createEvent('a-2', 'a', 'a2', {
      name: 'Borrado con fotos',
      startDate: new Date('2026-02-01'),
      photoQuota: 800,
      deletedAt: new Date(),
      photosUploaded: 5,
    })
    await createEvent('a-3', 'a', 'a2', {
      name: 'Ecuador OPEN',
      startDate: new Date('2026-03-01'),
      photoQuota: 3000,
    })
    await createEvent('a-del-empty', 'a', 'a2', { deletedAt: new Date(), photosUploaded: 0 })
    await createEvent('b-1', 'b', 'b1')
    await createEvent('b-2', 'b', 'b1')

    const platformTenant = await prisma.tenant.findFirstOrThrow({ where: { is_platform: true } })
    platformTenantId = platformTenant.id
  })

  afterAll(async () => {
    if (prisma) {
      await prisma.event.deleteMany({ where: { id: { in: eventIds } } })
      await prisma.tenantContract.deleteMany({
        where: { id: { in: Object.values(contractIds) } },
      })
      await prisma.user.deleteMany({ where: { id: { in: Object.values(userIds) } } })
      await prisma.tenant.deleteMany({ where: { id: { in: Object.values(tenantIds) } } })
      await prisma.$disconnect()
    }
    if (module) {
      await module.close()
    }
  })

  async function findOrganizer(name: string): Promise<OrganizerCardProjection> {
    const page = await repo.getOrganizersPage({ tab: 'all', search: runId }, new Pagination(1, 50))
    const row = page.items.find(
      (item): item is OrganizerCardProjection => item.kind === 'organizer' && item.name === name,
    )
    if (!row) throw new Error(`organizer ${name} not found`)
    return row
  }

  it('takes the photo limit from the oldest accepted valid contract with room, not the nearest expiry', async () => {
    const page = await repo.getOrganizersPage({ tab: 'all', search: runId }, new Pagination(1, 50))
    const e = page.items.find(
      (row): row is OrganizerCardProjection =>
        row.kind === 'organizer' && row.name === 'Limites distintos',
    )
    expect(e?.photosPerEventInUse).toBe(500)
    expect(e?.photoLimitsDiffer).toBe(true)
  })

  it('returns a slot when a deleted event never received photos, and keeps it when it did', async () => {
    const rows = await prisma.event.count({ where: { tenant_id: tenantIds.a } })
    const a = await findOrganizer('Con dos contratos')
    expect(rows).toBe(4)
    expect(a.usedCapacity).toBe(3)
    expect(a.available).toBe(7)
  })

  it('excludes expired capacity and reports it as lost', async () => {
    const a = await findOrganizer('Con dos contratos')
    expect(a.totalCapacity).toBe(10)
    expect(a.lostSlots).toBe(2)
    expect(a.photoLimitsDiffer).toBe(false)
  })

  it('resolves each organizer state from its contracts', async () => {
    const b = await findOrganizer('Sin cupo')
    const c = await findOrganizer('Vencido')
    const d = await findOrganizer('Por vencer')
    expect(b.state).toBe('no_quota')
    expect(c.state).toBe('no_quota')
    expect(c.nextExpiry).toBeNull()
    expect(c.lastExpiry).not.toBeNull()
    expect(d.state).toBe('expiring')
  })

  it('puts pending invitations first, then organizadores, then expired invitations', async () => {
    const page = await repo.getOrganizersPage(
      { tab: 'all', sort: 'events', search: runId },
      new Pagination(1, 50),
    )
    const kinds = page.items.map((row) => (row.kind === 'invitation' ? row.state : 'organizer'))
    expect(kinds.indexOf('pending')).toBeLessThan(kinds.indexOf('organizer'))
    expect(kinds.lastIndexOf('organizer')).toBeLessThan(kinds.indexOf('expired'))
  })

  it('never lists a revoked invitation', async () => {
    const page = await repo.getOrganizersPage({ tab: 'all', search: runId }, new Pagination(1, 50))
    expect(page.items.some((row) => row.kind === 'invitation' && row.state === 'revoked')).toBe(
      false,
    )
    expect(page.items.some((row) => row.kind === 'invitation' && row.commercialName === 'S')).toBe(
      false,
    )
  })

  it('labels a pending contract for an existing organizador as its renewal', async () => {
    const page = await repo.getOrganizersPage(
      { tab: 'invitations', search: runId },
      new Pagination(1, 50),
    )
    const q = page.items.find(
      (row): row is InvitationCardProjection =>
        row.kind === 'invitation' && row.commercialName === 'Q',
    )
    expect(q?.renewalOfOrganizerName).toBe('Por vencer')
    expect(q?.renewalOfOrganizerId).toBe(tenantIds.d)

    const p = page.items.find(
      (row): row is InvitationCardProjection =>
        row.kind === 'invitation' && row.commercialName === 'P',
    )
    expect(p?.renewalOfOrganizerName).toBeNull()
  })

  it('shows only organizadores on the capacity tabs', async () => {
    const active = await repo.getOrganizersPage(
      { tab: 'active', search: runId },
      new Pagination(1, 50),
    )
    const noQuota = await repo.getOrganizersPage(
      { tab: 'no_quota', search: runId },
      new Pagination(1, 50),
    )
    const expiring = await repo.getOrganizersPage(
      { tab: 'expiring', search: runId },
      new Pagination(1, 50),
    )

    expect(active.items.map((row) => row.kind === 'organizer' && row.name).sort()).toEqual([
      'Con dos contratos',
      'Limites distintos',
      'Por vencer',
    ])
    expect(noQuota.items.map((row) => row.kind === 'organizer' && row.name).sort()).toEqual([
      'Sin cupo',
      'Vencido',
    ])
    expect(expiring.items.map((row) => row.kind === 'organizer' && row.name)).toEqual([
      'Por vencer',
    ])
  })

  it('carries the total on the page and still reports it past the last page', async () => {
    const beyond = await repo.getOrganizersPage(
      { tab: 'all', search: runId },
      new Pagination(50, 10),
    )
    expect(beyond.items).toHaveLength(0)
    expect(beyond.total).toBe(8)
  })

  it('paginates without repeating or dropping a row', async () => {
    const first = await repo.getOrganizersPage({ tab: 'all', search: runId }, new Pagination(1, 5))
    const second = await repo.getOrganizersPage({ tab: 'all', search: runId }, new Pagination(2, 5))
    const ids = [...first.items, ...second.items].map((row) => row.id)
    expect(first.total).toBe(8)
    expect(ids).toHaveLength(8)
    expect(new Set(ids).size).toBe(8)
  })

  it('counts an organizador that is about to expire under active as well as por vencer', async () => {
    const stats = await repo.getOrganizersStats({ search: runId })
    expect(stats.active).toBe(3)
    expect(stats.expiring).toBe(1)
    expect(stats.noQuota).toBe(2)
  })

  it('counts only acceptable invitations in the pending tile', async () => {
    const stats = await repo.getOrganizersStats({ search: runId })
    expect(stats.pending).toBe(2)
  })

  it('gives every tab a count equal to the rows that tab returns', async () => {
    const stats = await repo.getOrganizersStats({ search: runId })
    const counted = await Promise.all(
      ORGANIZER_TABS.map((tab) =>
        repo.getOrganizersPage({ tab, search: runId }, new Pagination(1, 100)),
      ),
    )
    expect(counted.map((page) => page.total)).toEqual([
      stats.tabs.all,
      stats.tabs.active,
      stats.tabs.noQuota,
      stats.tabs.expiring,
      stats.tabs.invitations,
    ])
  })

  it('honours the search in the tiles', async () => {
    const stats = await repo.getOrganizersStats({ search: email('b') })
    expect(stats.active).toBe(0)
    expect(stats.noQuota).toBe(1)
  })

  it('returns the contract history oldest first, marking the expired one as a loss', async () => {
    const detail = await repo.getOrganizerDetail(tenantIds.conDosContratos)
    expect(detail?.contracts.map((k) => k.lostSlots)).toEqual([2, 0])
    expect(detail?.contracts.map((k) => k.isValid)).toEqual([false, true])
  })

  it('reports the default photo quota separately from any contract limit', async () => {
    const detail = await repo.getOrganizerDetail(tenantIds.conDosContratos)
    expect(detail?.defaultEventPhotoQuota).toBe(1500)
    expect(detail?.photosPerEventInUse).toBe(3000)
  })

  it('returns null for an unknown organizador', async () => {
    expect(await repo.getOrganizerDetail(randomUUID())).toBeNull()
  })

  it('never returns a platform tenant', async () => {
    expect(await repo.getOrganizerDetail(platformTenantId)).toBeNull()
  })

  it('lists the organizador events newest first, each against its own snapshotted quota', async () => {
    const page = await repo.getOrganizerEvents(tenantIds.conDosContratos, new Pagination(1, 20))
    expect(page.items[0].photoQuota).toBe(3000)
    expect(page.items.map((e) => e.name)).toEqual([
      'Ecuador OPEN',
      'Borrado con fotos',
      'Copa Bike Parks',
    ])
  })

  it('includes an event that was deleted after receiving photos', async () => {
    const page = await repo.getOrganizerEvents(tenantIds.conDosContratos, new Pagination(1, 20))
    expect(page.items.some((e) => e.name === 'Borrado con fotos')).toBe(true)
  })
})
