import type { Prisma } from '@generated/prisma/client'
import type { ContractProjection } from '../../application/projections/contract.projection'
import type { TenantContract } from '../entities/tenant-contract.entity'

export const CONTRACT_REPOSITORY = Symbol('CONTRACT_REPOSITORY')

export interface AcceptContractPayload {
  contractId: string
  userId: string
  ip: string | null
  userAgent: string | null
  termsVersion: string
  commercialName: string
}

export interface IContractRepository {
  findByTokenHash(tokenHash: string): Promise<TenantContract | null>
  findById(id: string): Promise<TenantContract | null>
  findPendingByUserId(userId: string): Promise<TenantContract | null>
  listAll(): Promise<ContractProjection[]>
  listByUser(userId: string): Promise<ContractProjection[]>
  create(contract: TenantContract, tokenHash: string): Promise<void>
  acceptInTransaction(
    data: AcceptContractPayload,
  ): Promise<{ tenantId: string; tenantCreated: boolean }>
  revoke(id: string): Promise<void>
  rotateToken(id: string, tokenHash: string): Promise<void>
  consumeSlot(tenantId: string, tx: Prisma.TransactionClient): Promise<TenantContract | null>
  findNextUsable(tenantId: string): Promise<{ contract: TenantContract; eventsUsed: number } | null>
  findMostRecentAccepted(
    tenantId: string,
  ): Promise<{ contract: TenantContract; eventsUsed: number } | null>
}
