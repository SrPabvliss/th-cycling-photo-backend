import {
  type InvoiceStateView,
  OrderInvoiceState,
} from '@shared/rikuchiy/domain/order-invoice-state'
import type { CachedTaxDocument, OutboxRow } from '@shared/rikuchiy/domain/ports'
import type { MyOrderInvoiceProjection } from './my-order-invoice.projection'
import type { OrderInvoiceProjection } from './order-invoice.projection'

const DOWNLOADABLE_INVOICE_STATES = ['authorized', 'annulled']
const REJECTED_STATES = ['returned', 'not_authorized']
const BUYER_STATE_OF_A_REJECTED_CREDIT_NOTE = 'submitted'

export function isTaxDocumentDownloadable(document: CachedTaxDocument): boolean {
  if (document.type === 'credit_note') return document.state === 'authorized'
  return DOWNLOADABLE_INVOICE_STATES.includes(document.state)
}

const TYPE_ORDER: Record<CachedTaxDocument['type'], number> = { invoice: 0, credit_note: 1 }

function sortedForDisplay(
  rows: OutboxRow[],
  documents: CachedTaxDocument[],
  currentExternalRef: string | null,
): CachedTaxDocument[] {
  const firstRequestedAt = new Map<string, number>()
  for (const row of rows) {
    const requestedAt = row.createdAt.getTime()
    const known = firstRequestedAt.get(row.externalRef)
    if (known === undefined || requestedAt < known)
      firstRequestedAt.set(row.externalRef, requestedAt)
  }
  const rankOf = (externalRef: string): number =>
    externalRef === currentExternalRef
      ? Number.NEGATIVE_INFINITY
      : -(firstRequestedAt.get(externalRef) ?? 0)

  return [...documents].sort(
    (a, b) =>
      rankOf(a.externalRef) - rankOf(b.externalRef) ||
      TYPE_ORDER[a.type] - TYPE_ORDER[b.type] ||
      a.number.localeCompare(b.number),
  )
}

function isResendable(document: CachedTaxDocument): boolean {
  return document.state === 'authorized'
}

function buyerStateOf(document: CachedTaxDocument): string {
  if (document.type === 'credit_note' && REJECTED_STATES.includes(document.state)) {
    return BUYER_STATE_OF_A_REJECTED_CREDIT_NOTE
  }
  return document.state
}

function isSriRejection(view: InvoiceStateView): boolean {
  return view.state === 'rejected' && view.rejection?.source === 'sri'
}

export function toOrderInvoice(
  rows: OutboxRow[],
  documents: CachedTaxDocument[],
): OrderInvoiceProjection | null {
  const view = OrderInvoiceState.derive(rows, documents)
  if (view.state === 'none') return null

  const source = view.rejection?.source
  return {
    state: view.state,
    rejection: view.rejection,
    canCorrect:
      view.state === 'rejected' &&
      (source === 'sri' || source === 'intake') &&
      !view.hasPendingEmission,
    canRetryAnnulment: source === 'credit_note' && !view.hasPendingAnnulment,
    documents: sortedForDisplay(rows, documents, view.currentExternalRef).map((document) => {
      const downloadable = isTaxDocumentDownloadable(document)
      return {
        id: document.id,
        type: document.type,
        state: document.state,
        number: document.number,
        accessKey: document.accessKey,
        issueDate: document.issueDate,
        authorizedAt: document.authorizedAt,
        sriMessages: document.sriMessages,
        deliveries: document.deliveries,
        downloadable,
        resendable: isResendable(document),
        current: document.externalRef === view.currentExternalRef,
      }
    }),
  }
}

export function toMyOrderInvoice(
  rows: OutboxRow[],
  documents: CachedTaxDocument[],
): MyOrderInvoiceProjection | null {
  const view = OrderInvoiceState.derive(rows, documents)
  if (view.state === 'none') return null

  const sriRejection = isSriRejection(view)
  const hiddenRejection = view.state === 'rejected' && !sriRejection
  return {
    state: hiddenRejection ? 'in_process' : view.state,
    rejectionMessages: sriRejection ? (view.rejection?.messages ?? []) : [],
    canCorrect: sriRejection && !view.hasPendingEmission,
    documents: sortedForDisplay(rows, documents, view.currentExternalRef).map((document) => ({
      id: document.id,
      type: document.type,
      state: buyerStateOf(document),
      number: document.number,
      issueDate: document.issueDate,
      downloadable: isTaxDocumentDownloadable(document),
      current: document.externalRef === view.currentExternalRef,
    })),
  }
}
