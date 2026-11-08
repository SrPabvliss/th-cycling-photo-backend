import type { IAuthorizationService } from '@shared/authorization/domain/ports/authorization.service.port'
import { AppException } from '@shared/domain'
import type { EventPayoutSelection } from './event-configuration.service'

/**
 * A new account or phone on an event decides where the event's money lands, which is the same call
 * as managing the profile's payout methods (TIT-95): platform staff create and edit events but must
 * not redirect TitanTV's money. Picking a profile method, or re-sending a method the event already
 * has (`event`, resolved against that event's own rows), only chooses among destinations an owner
 * already set up, so staff may still drop a method or switch it back to the profile.
 */
export async function assertMayChoosePayouts(
  authz: IAuthorizationService,
  actorUserId: string,
  payoutMethods: EventPayoutSelection[] | undefined,
): Promise<void> {
  if (!payoutMethods?.some((entry) => entry.source === 'new')) return
  if (await authz.canAnywhere(actorUserId, 'tenant.payout_method.manage')) return

  throw AppException.forbidden('event.payout_method_manage_required')
}
