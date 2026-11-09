import type { OutboxRow } from './ports/rikuchiy-outbox-repository.port'

export interface RikuchiyAnnulmentPayload {
  emissionId: string
  reason: string
}

export class RikuchiyAnnulment {
  static readonly REASONS = {
    cancelled: 'Pedido cancelado',
    gifted: 'Pedido convertido en cortesía',
  } as const

  static build(emissionId: string, reason: AnnulmentReason): RikuchiyAnnulmentPayload {
    return { emissionId, reason: RikuchiyAnnulment.REASONS[reason] }
  }

  static liveOf(rows: OutboxRow[]): OutboxRow[] {
    return rows.filter(
      (row) => row.kind === 'annul' && (row.status === 'pending' || row.status === 'sent'),
    )
  }
}

export type AnnulmentReason = keyof typeof RikuchiyAnnulment.REASONS
