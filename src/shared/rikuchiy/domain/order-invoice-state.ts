import type { CachedTaxDocument, OutboxRow } from './ports'
import { RikuchiyAnnulment } from './rikuchiy-annulment'

export type OrderInvoiceStateValue =
  | 'none'
  | 'requested'
  | 'in_process'
  | 'authorized'
  | 'rejected'
  | 'annulled'

export interface InvoiceRejection {
  source: 'sri' | 'intake' | 'credit_note'
  messages: string[]
}

export interface InvoiceStateView {
  state: OrderInvoiceStateValue
  rejection: InvoiceRejection | null
  currentExternalRef: string | null
  hasPendingEmission: boolean
  hasPendingAnnulment: boolean
}

export class OrderInvoiceState {
  private static readonly REJECTED_STATES = ['returned', 'not_authorized']

  static derive(rows: OutboxRow[], documents: CachedTaxDocument[]): InvoiceStateView {
    const emissions = rows.filter((row) => row.kind === 'emit' && row.status !== 'suppressed')
    if (emissions.length === 0) {
      return OrderInvoiceState.view('none', null, null, false, false)
    }

    const lastEmission = emissions[emissions.length - 1]
    const currentExternalRef = lastEmission.externalRef
    const invoice = documents.find(
      (document) => document.externalRef === currentExternalRef && document.type === 'invoice',
    )
    const creditNote = documents.find(
      (document) => document.externalRef === currentExternalRef && document.type === 'credit_note',
    )
    const annuls = RikuchiyAnnulment.liveOf(rows).filter(
      (row) => row.externalRef === currentExternalRef,
    )
    const hasPendingEmission = lastEmission.status === 'pending'
    const hasPendingAnnulment = annuls.some((row) => row.status === 'pending')
    const make = (state: OrderInvoiceStateValue, rejection: InvoiceRejection | null = null) =>
      OrderInvoiceState.view(
        state,
        rejection,
        currentExternalRef,
        hasPendingEmission,
        hasPendingAnnulment,
      )

    if (lastEmission.status === 'rejected' && !invoice) {
      return make('rejected', {
        source: 'intake',
        messages: lastEmission.rejectionReason ? [lastEmission.rejectionReason] : [],
      })
    }
    if (hasPendingEmission) return make(invoice ? 'in_process' : 'requested')
    if (!invoice) return make('in_process')

    if (invoice.state === 'annulled' || invoice.state === 'cancelled') return make('annulled')
    const lastSentAnnul = annuls.filter((row) => row.status === 'sent').at(-1)
    if (
      creditNote &&
      OrderInvoiceState.REJECTED_STATES.includes(creditNote.state) &&
      !OrderInvoiceState.isSentAfterSync(lastSentAnnul, creditNote)
    ) {
      return make('rejected', {
        source: 'credit_note',
        messages: OrderInvoiceState.messagesOf(creditNote),
      })
    }
    if (annuls.length > 0) return make('in_process')
    const lastSentEmission = emissions
      .filter((row) => row.status === 'sent' && row.externalRef === currentExternalRef)
      .at(-1)
    if (
      OrderInvoiceState.REJECTED_STATES.includes(invoice.state) &&
      !OrderInvoiceState.isSentAfterSync(lastSentEmission, invoice)
    ) {
      return make('rejected', { source: 'sri', messages: OrderInvoiceState.messagesOf(invoice) })
    }
    if (invoice.state === 'authorized') return make('authorized')
    return make('in_process')
  }

  private static isSentAfterSync(row: OutboxRow | undefined, document: CachedTaxDocument): boolean {
    if (!row?.sentAt || !document.syncedAt) return false
    return row.sentAt.getTime() >= document.syncedAt.getTime()
  }

  private static messagesOf(document: CachedTaxDocument): string[] {
    return document.sriMessages.map((entry) =>
      entry.additionalInfo
        ? `${entry.identifier}: ${entry.message} — ${entry.additionalInfo}`
        : `${entry.identifier}: ${entry.message}`,
    )
  }

  private static view(
    state: OrderInvoiceStateValue,
    rejection: InvoiceRejection | null,
    currentExternalRef: string | null,
    hasPendingEmission: boolean,
    hasPendingAnnulment: boolean,
  ): InvoiceStateView {
    return { state, rejection, currentExternalRef, hasPendingEmission, hasPendingAnnulment }
  }
}
