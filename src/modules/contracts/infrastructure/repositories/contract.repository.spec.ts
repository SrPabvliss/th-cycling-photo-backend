import { CONSENT_TYPE } from '@auth/domain/constants/consent.constants'
import { TEMPLATE_KEYS } from '@shared/authorization/domain/permission-template.constants'
import { EVENT_SLOT_CONSUMED_FILTER } from '@shared/domain'
import type { AcceptContractPayload } from '../../domain/ports/contract-repository.port'
import { ContractRepository } from './contract.repository'

const PAYLOAD: AcceptContractPayload = {
  contractId: 'contract-1',
  userId: 'user-1',
  ip: '127.0.0.1',
  userAgent: 'jest-agent',
  termsVersion: 'v1.3-frozen',
  commercialName: 'Vuelta Ambato',
}

function buildRepository(tenantId: string | null) {
  const updateManyTenantContract = jest.fn().mockResolvedValue({ count: 1 })
  const upsertUserConsent = jest.fn().mockResolvedValue(undefined)
  const findUniqueOrThrowUser = jest.fn().mockResolvedValue({ tenant_id: tenantId })
  const findUniquePermissionTemplate = jest.fn().mockResolvedValue({ id: 'template-tenant' })
  const createTenant = jest.fn().mockResolvedValue({ id: 'tenant-new' })
  const updateUser = jest.fn().mockResolvedValue(undefined)
  const updateTenantContract = jest.fn().mockResolvedValue(undefined)

  const tx = {
    tenantContract: {
      updateMany: updateManyTenantContract,
      update: updateTenantContract,
    },
    userConsent: { upsert: upsertUserConsent },
    user: { findUniqueOrThrow: findUniqueOrThrowUser, update: updateUser },
    permissionTemplate: { findUnique: findUniquePermissionTemplate },
    tenant: { create: createTenant },
  }

  const prisma = {
    $transaction: jest.fn((callback: (tx: unknown) => Promise<unknown>) => callback(tx)),
  }

  return {
    repository: new ContractRepository(prisma as never),
    tx,
  }
}

describe('ContractRepository.acceptInTransaction', () => {
  it('creates the tenant, grants the tenant template, and bumps permissions_version when the user has no tenant yet', async () => {
    const { repository, tx } = buildRepository(null)

    const result = await repository.acceptInTransaction(PAYLOAD)

    expect(result).toEqual({ tenantId: 'tenant-new', tenantCreated: true })

    expect(tx.tenant.create).toHaveBeenCalledTimes(1)
    expect(tx.tenant.create).toHaveBeenCalledWith({
      data: { name: 'Vuelta Ambato', event_quota: 0, is_platform: false },
    })

    expect(tx.permissionTemplate.findUnique).toHaveBeenCalledWith({
      where: { key: TEMPLATE_KEYS.TENANT },
    })

    expect(tx.user.update).toHaveBeenCalledTimes(1)
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        tenant_id: 'tenant-new',
        permission_template_id: 'template-tenant',
        permissions_version: { increment: 1 },
      },
    })

    expect(tx.tenantContract.update).toHaveBeenCalledWith({
      where: { id: 'contract-1' },
      data: { tenant_id: 'tenant-new' },
    })
  })

  it('reuses the existing tenant and does not create one or touch permissions when the user already has a tenant', async () => {
    const { repository, tx } = buildRepository('tenant-existing')

    const result = await repository.acceptInTransaction(PAYLOAD)

    expect(result).toEqual({ tenantId: 'tenant-existing', tenantCreated: false })

    expect(tx.tenant.create).not.toHaveBeenCalled()
    expect(tx.permissionTemplate.findUnique).not.toHaveBeenCalled()
    expect(tx.user.update).not.toHaveBeenCalled()

    expect(tx.tenantContract.update).toHaveBeenCalledTimes(1)
    expect(tx.tenantContract.update).toHaveBeenCalledWith({
      where: { id: 'contract-1' },
      data: { tenant_id: 'tenant-existing' },
    })
  })

  it('records the consent at the payload own frozen terms version', async () => {
    const { repository, tx } = buildRepository(null)

    await repository.acceptInTransaction(PAYLOAD)

    expect(tx.userConsent.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          user_id_type_policy_version: {
            user_id: 'user-1',
            type: CONSENT_TYPE.TERMS_TENANT,
            policy_version: 'v1.3-frozen',
          },
        },
      }),
    )
  })

  it('throws contract.already_accepted and writes nothing else when the status guard finds no pending row', async () => {
    const { repository, tx } = buildRepository(null)
    tx.tenantContract.updateMany.mockResolvedValue({ count: 0 })

    await expect(repository.acceptInTransaction(PAYLOAD)).rejects.toMatchObject({
      messageKey: 'contract.already_accepted',
    })

    expect(tx.userConsent.upsert).not.toHaveBeenCalled()
    expect(tx.tenant.create).not.toHaveBeenCalled()
  })
})

describe('ContractRepository.consumeSlot', () => {
  it('counts events under the same refund filter used for quota so a soft-deleted, never-uploaded event does not consume a slot', async () => {
    const findManyTenantContract = jest.fn().mockResolvedValue([
      {
        id: 'contract-1',
        events_total: 1,
        _count: { events: 0 },
        status: 'accepted',
      },
    ])
    const queryRaw = jest.fn().mockResolvedValue([{ id: 'contract-1' }])
    const tx = { tenantContract: { findMany: findManyTenantContract }, $queryRaw: queryRaw }
    const prisma = {}
    const repository = new ContractRepository(prisma as never)

    const result = await repository.consumeSlot('tenant-1', tx as never)

    expect(result).not.toBeNull()
    expect(queryRaw).toHaveBeenCalledTimes(1)
    expect(findManyTenantContract).toHaveBeenCalledWith(
      expect.objectContaining({
        include: { _count: { select: { events: { where: EVENT_SLOT_CONSUMED_FILTER } } } },
      }),
    )
  })

  it('returns null when the only slot left is already occupied by a live event', async () => {
    const findManyTenantContract = jest.fn().mockResolvedValue([
      {
        id: 'contract-1',
        events_total: 1,
        _count: { events: 1 },
        status: 'accepted',
      },
    ])
    const queryRaw = jest.fn().mockResolvedValue([{ id: 'contract-1' }])
    const tx = { tenantContract: { findMany: findManyTenantContract }, $queryRaw: queryRaw }
    const prisma = {}
    const repository = new ContractRepository(prisma as never)

    const result = await repository.consumeSlot('tenant-1', tx as never)

    expect(result).toBeNull()
  })

  it('returns null without querying event counts when no accepted, in-date contract is found', async () => {
    const findManyTenantContract = jest.fn()
    const queryRaw = jest.fn().mockResolvedValue([])
    const tx = { tenantContract: { findMany: findManyTenantContract }, $queryRaw: queryRaw }
    const prisma = {}
    const repository = new ContractRepository(prisma as never)

    const result = await repository.consumeSlot('tenant-1', tx as never)

    expect(result).toBeNull()
    expect(findManyTenantContract).not.toHaveBeenCalled()
  })
})

describe('ContractRepository.rotateToken', () => {
  it('overwrites token_hash on the same row without touching status or terms', async () => {
    const update = jest.fn().mockResolvedValue(undefined)
    const prisma = { tenantContract: { update } }
    const repository = new ContractRepository(prisma as never)

    await repository.rotateToken('contract-1', 'new-hash')

    expect(update).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledWith({
      where: { id: 'contract-1' },
      data: { token_hash: 'new-hash' },
    })
  })
})
