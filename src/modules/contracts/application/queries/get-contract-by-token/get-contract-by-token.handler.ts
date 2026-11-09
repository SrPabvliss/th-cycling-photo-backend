import { AUTH_USER_REPOSITORY, type IAuthUserRepository } from '@auth/domain/ports'
import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { AppException, toEcuadorDateOnly } from '@shared/domain'
import type { TenantContract } from '../../../domain/entities/tenant-contract.entity'
import { hashContractToken } from '../../../domain/hash-contract-token'
import {
  CONTRACT_REPOSITORY,
  type IContractRepository,
} from '../../../domain/ports/contract-repository.port'
import type { ContractOfferProjection } from '../../projections/contract-offer.projection'
import { GetContractByTokenQuery } from './get-contract-by-token.query'

function blockedReasonFor(
  contract: TenantContract,
  userId: string,
  emailVerified: boolean,
): string | null {
  try {
    contract.assertAcceptableBy(userId, emailVerified, new Date())
    return null
  } catch (error) {
    if (error instanceof AppException) return error.messageKey
    throw error
  }
}

@QueryHandler(GetContractByTokenQuery)
export class GetContractByTokenHandler implements IQueryHandler<GetContractByTokenQuery> {
  constructor(
    @Inject(CONTRACT_REPOSITORY) private readonly contractRepo: IContractRepository,
    @Inject(AUTH_USER_REPOSITORY) private readonly authUserRepo: IAuthUserRepository,
  ) {}

  async execute(query: GetContractByTokenQuery): Promise<ContractOfferProjection> {
    const tokenHash = hashContractToken(query.token)
    const contract = await this.contractRepo.findByTokenHash(tokenHash)
    if (!contract) throw AppException.notFound('entities.tenant_contract', query.token)

    const me = await this.authUserRepo.getMe(query.userId)
    const emailVerified = me?.emailVerified ?? false

    const blockedReason = blockedReasonFor(contract, query.userId, emailVerified)

    if (blockedReason === 'contract.not_yours') {
      return {
        id: null,
        commercialName: null,
        eventsTotal: null,
        photosPerEvent: null,
        validUntil: null,
        termsVersion: null,
        status: null,
        blockedReason,
      }
    }

    return {
      id: contract.id,
      commercialName: contract.commercialName,
      eventsTotal: contract.eventsTotal,
      photosPerEvent: contract.photosPerEvent,
      validUntil: toEcuadorDateOnly(contract.validUntil),
      termsVersion: contract.termsVersion,
      status: contract.status,
      blockedReason,
    }
  }
}
