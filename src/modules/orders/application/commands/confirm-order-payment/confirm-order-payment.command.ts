import type { AuditContext } from '@shared/application'

/**
 * What to do when, under the order's lock, the order turns out to be paid already.
 *
 * - `reject`: answer `order.not_pending`, as staff marking a transfer as paid always has.
 * - `skip`: do nothing and say so. The card payment path uses it, because a second confirmation
 *   of the same charge (the browser and the sweep, or two tabs) must end quietly.
 */
export type WhenAlreadyPaid = 'reject' | 'skip'

/** `alreadyPaid` only appears when the run found the order paid and was told to skip it. */
export type ConfirmOrderPaymentResult = { id: string; alreadyPaid?: true }

export class ConfirmOrderPaymentCommand {
  constructor(
    public readonly orderId: string,
    public readonly audit: AuditContext,
    public readonly whenAlreadyPaid: WhenAlreadyPaid = 'reject',
  ) {}
}
