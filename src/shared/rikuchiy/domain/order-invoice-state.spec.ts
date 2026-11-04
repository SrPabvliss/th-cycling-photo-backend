import { OrderInvoiceState } from './order-invoice-state'
import type { CachedTaxDocument, OutboxRow } from './ports'

describe('OrderInvoiceState.derive', () => {
  let clock = 0
  const sentAt = new Date('2026-11-03T10:00:00Z')
  const syncedAt = new Date('2026-11-03T10:05:00Z')
  const resentAt = new Date('2026-11-03T10:10:00Z')
  const row = (overrides: Partial<OutboxRow> = {}): OutboxRow => ({
    kind: 'emit',
    status: 'sent',
    externalRef: 'order-1',
    createdAt: new Date(2026, 10, 1, 0, 0, clock++),
    sentAt: null,
    outcome: null,
    rejectionReason: null,
    payload: {},
    ...overrides,
  })
  const document = (overrides: Partial<CachedTaxDocument> = {}): CachedTaxDocument => ({
    id: `doc-${clock++}`,
    externalRef: 'order-1',
    type: 'invoice',
    state: 'authorized',
    number: '001-001-000000001',
    accessKey: '1'.repeat(49),
    issueDate: '2026-11-03',
    authorizedAt: new Date('2026-11-03T15:00:00Z'),
    sriMessages: [],
    deliveries: [],
    syncedAt,
    ...overrides,
  })
  const returned = (
    type: CachedTaxDocument['type'] = 'invoice',
    overrides: Partial<CachedTaxDocument> = {},
  ) =>
    document({
      type,
      state: 'returned',
      sriMessages: [
        { identifier: '35', message: 'RUC invalido', additionalInfo: 'revisar', type: 'ERROR' },
        { identifier: '43', message: 'Clave repetida', additionalInfo: null, type: 'ERROR' },
      ],
      ...overrides,
    })

  const cases: [string, OutboxRow[], CachedTaxDocument[], object][] = [
    ['no rows', [], [], { state: 'none', currentExternalRef: null }],
    ['only suppressed emissions', [row({ status: 'suppressed' })], [], { state: 'none' }],
    [
      'intake rejection without invoice',
      [row({ status: 'rejected', rejectionReason: 'Identificacion invalida' })],
      [],
      {
        state: 'rejected',
        rejection: { source: 'intake', messages: ['Identificacion invalida'] },
      },
    ],
    [
      'pending emission without invoice',
      [row({ status: 'pending' })],
      [],
      { state: 'requested', hasPendingEmission: true },
    ],
    [
      'pending correction over a returned invoice',
      [row(), row({ status: 'pending' })],
      [returned()],
      { state: 'in_process', hasPendingEmission: true },
    ],
    ['sent emission without invoice yet', [row()], [], { state: 'in_process' }],
    ['annulled invoice', [row()], [document({ state: 'annulled' })], { state: 'annulled' }],
    ['cancelled invoice', [row()], [document({ state: 'cancelled' })], { state: 'annulled' }],
    [
      'returned credit note',
      [row(), row({ kind: 'annul', status: 'sent' })],
      [document(), returned('credit_note')],
      {
        state: 'rejected',
        rejection: {
          source: 'credit_note',
          messages: ['35: RUC invalido — revisar', '43: Clave repetida'],
        },
      },
    ],
    [
      'not authorized credit note',
      [row()],
      [document(), document({ type: 'credit_note', state: 'not_authorized' })],
      { state: 'rejected', rejection: { source: 'credit_note', messages: [] } },
    ],
    [
      'sent annulment over an authorized invoice',
      [row(), row({ kind: 'annul', status: 'sent', outcome: 'pending' })],
      [document()],
      { state: 'in_process', hasPendingAnnulment: false },
    ],
    [
      'pending annulment over an authorized invoice',
      [row(), row({ kind: 'annul', status: 'pending' })],
      [document()],
      { state: 'in_process', hasPendingAnnulment: true },
    ],
    [
      'rejected annulment does not count',
      [row(), row({ kind: 'annul', status: 'rejected' })],
      [document()],
      { state: 'authorized', hasPendingAnnulment: false },
    ],
    [
      'returned invoice',
      [row()],
      [returned()],
      {
        state: 'rejected',
        rejection: {
          source: 'sri',
          messages: ['35: RUC invalido — revisar', '43: Clave repetida'],
        },
      },
    ],
    [
      'not authorized invoice',
      [row()],
      [document({ state: 'not_authorized' })],
      { state: 'rejected' },
    ],
    ['authorized invoice', [row()], [document()], { state: 'authorized', rejection: null }],
    [
      'invoice still in the SRI',
      [row()],
      [document({ state: 'received' })],
      { state: 'in_process' },
    ],
    [
      'rejected correction over an authorized invoice',
      [row(), row({ status: 'rejected', rejectionReason: 'x' })],
      [document()],
      { state: 'authorized' },
    ],
    [
      'resale takes its new reference and ignores the annulled invoice',
      [
        row({ externalRef: 'order-1' }),
        row({ kind: 'annul', externalRef: 'order-1' }),
        row({ externalRef: 'order-1-2', status: 'pending' }),
      ],
      [document({ state: 'annulled' })],
      { state: 'requested', currentExternalRef: 'order-1-2' },
    ],
    [
      'resale authorized',
      [row(), row({ kind: 'annul' }), row({ externalRef: 'order-1-2' })],
      [document({ state: 'annulled' }), document({ externalRef: 'order-1-2' })],
      { state: 'authorized', currentExternalRef: 'order-1-2' },
    ],
    [
      'correction sent after the last sync of a returned invoice',
      [row({ sentAt }), row({ sentAt: resentAt })],
      [returned()],
      { state: 'in_process', rejection: null, hasPendingEmission: false },
    ],
    [
      'returned invoice synced after its correction was sent',
      [row({ sentAt }), row({ sentAt: resentAt })],
      [returned('invoice', { syncedAt: new Date('2026-11-03T10:15:00Z') })],
      { state: 'rejected', rejection: { source: 'sri' } },
    ],
    [
      'cached document fresh from rikuchiy is never stale',
      [row({ sentAt: resentAt })],
      [returned('invoice', { syncedAt: null })],
      { state: 'rejected', rejection: { source: 'sri' } },
    ],
    [
      'annulment retried after the last sync of a returned credit note',
      [row({ sentAt }), row({ kind: 'annul', sentAt }), row({ kind: 'annul', sentAt: resentAt })],
      [document(), returned('credit_note')],
      { state: 'in_process', rejection: null, hasPendingAnnulment: false },
    ],
    [
      'credit note returned again after the retried annulment',
      [row({ sentAt }), row({ kind: 'annul', sentAt }), row({ kind: 'annul', sentAt: resentAt })],
      [document(), returned('credit_note', { syncedAt: new Date('2026-11-03T10:15:00Z') })],
      { state: 'rejected', rejection: { source: 'credit_note' } },
    ],
    [
      'withdrawn emission accepted on the way, its annulment pending',
      [row({ sentAt }), row({ kind: 'annul', status: 'pending' })],
      [],
      { state: 'in_process', hasPendingAnnulment: true, currentExternalRef: 'order-1' },
    ],
    [
      'withdrawn emission accepted on the way, then cancelled',
      [row({ sentAt }), row({ kind: 'annul', sentAt: resentAt, outcome: 'cancelled' })],
      [document({ state: 'cancelled', syncedAt: new Date('2026-11-03T10:15:00Z') })],
      { state: 'annulled' },
    ],
    [
      'live annulment over a returned invoice',
      [row(), row({ kind: 'annul', status: 'pending' })],
      [returned()],
      { state: 'in_process', rejection: null, hasPendingAnnulment: true },
    ],
    [
      'sent annulment over a returned invoice',
      [row({ sentAt }), row({ kind: 'annul', sentAt: resentAt, outcome: 'cancelled' })],
      [returned()],
      { state: 'in_process', rejection: null },
    ],
    [
      'suppressed emission after a live one',
      [row(), row({ status: 'suppressed' })],
      [document()],
      { state: 'authorized', hasPendingEmission: false, currentExternalRef: 'order-1' },
    ],
    [
      'suppressed correction over a returned invoice, its annulment pending',
      [row(), row({ status: 'suppressed' }), row({ kind: 'annul', status: 'pending' })],
      [returned()],
      { state: 'in_process', hasPendingEmission: false, hasPendingAnnulment: true },
    ],
  ]

  it.each(cases)('%s', (_name, rows, documents, expected) => {
    expect(OrderInvoiceState.derive(rows, documents)).toMatchObject(expected)
  })
})
