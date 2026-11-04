import type { CachedTaxDocument, OutboxRow } from '@shared/rikuchiy/domain/ports'
import { isTaxDocumentDownloadable, toMyOrderInvoice, toOrderInvoice } from './order-invoice.mapper'

describe('order invoice mapper', () => {
  let clock = 0
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
    syncedAt: null,
    ...overrides,
  })
  const sriMessages = [
    { identifier: '35', message: 'RUC invalido', additionalInfo: null, type: 'ERROR' },
  ]
  const annul = (overrides: Partial<OutboxRow> = {}) => row({ kind: 'annul', ...overrides })
  const returnedCreditNote = () =>
    document({
      type: 'credit_note',
      state: 'returned',
      authorizedAt: null,
      issueDate: '2026-11-04',
      sriMessages,
    })

  describe('isTaxDocumentDownloadable', () => {
    it.each([
      ['invoice', 'authorized', true],
      ['invoice', 'annulled', true],
      ['invoice', 'cancelled', false],
      ['invoice', 'received', false],
      ['invoice', 'returned', false],
      ['credit_note', 'authorized', true],
      ['credit_note', 'returned', false],
      ['credit_note', 'annulled', false],
    ] as const)('%s %s → %s', (type, state, expected) => {
      expect(isTaxDocumentDownloadable(document({ type, state }))).toBe(expected)
    })

    it('offers the downloads of an annulled invoice and its authorized credit note', () => {
      const rows = [row(), annul()]
      const documents = [
        document({ state: 'annulled' }),
        document({ type: 'credit_note', issueDate: '2026-11-04' }),
      ]

      for (const invoice of [toOrderInvoice(rows, documents), toMyOrderInvoice(rows, documents)]) {
        expect(invoice?.state).toBe('annulled')
        expect(invoice?.documents.map((entry) => entry.downloadable)).toEqual([true, true])
      }
    })
  })

  describe('canRetryAnnulment', () => {
    it('is offered to the admin over a rejected credit note', () => {
      const invoice = toOrderInvoice([row(), annul()], [document(), returnedCreditNote()])

      expect(invoice?.state).toBe('rejected')
      expect(invoice?.rejection?.source).toBe('credit_note')
      expect(invoice?.canRetryAnnulment).toBe(true)
      expect(invoice?.canCorrect).toBe(false)
    })

    it('is not offered while the retry is pending', () => {
      const invoice = toOrderInvoice(
        [row(), annul(), annul({ status: 'pending' })],
        [document(), returnedCreditNote()],
      )

      expect(invoice?.canRetryAnnulment).toBe(false)
    })

    it('is not offered over an SRI rejection of the invoice', () => {
      const invoice = toOrderInvoice(
        [row()],
        [document({ state: 'returned', authorizedAt: null, sriMessages })],
      )

      expect(invoice?.canRetryAnnulment).toBe(false)
    })
  })

  describe('a rejected credit note', () => {
    it('stays out of sight for the buyer', () => {
      const invoice = toMyOrderInvoice([row(), annul()], [document(), returnedCreditNote()])

      expect(invoice?.state).toBe('in_process')
      expect(invoice?.rejectionMessages).toEqual([])
      expect(invoice?.canCorrect).toBe(false)
      const creditNote = invoice?.documents.find((entry) => entry.type === 'credit_note')
      expect(creditNote).toMatchObject({ state: 'submitted', downloadable: false })
    })

    it('reaches the admin as it came from the SRI', () => {
      const invoice = toOrderInvoice([row(), annul()], [document(), returnedCreditNote()])

      const creditNote = invoice?.documents.find((entry) => entry.type === 'credit_note')
      expect(creditNote).toMatchObject({ state: 'returned', sriMessages })
    })

    it('leaves the buyer the real state of a credit note that was not rejected', () => {
      const invoice = toMyOrderInvoice(
        [row(), annul()],
        [document(), document({ type: 'credit_note', state: 'received', authorizedAt: null })],
      )

      const creditNote = invoice?.documents.find((entry) => entry.type === 'credit_note')
      expect(creditNote?.state).toBe('received')
    })
  })

  describe('canCorrect by rejection source', () => {
    const sriRejected = () => [document({ state: 'not_authorized', authorizedAt: null })]
    const intakeRejected = () => [
      row({ status: 'rejected', rejectionReason: 'Identificación inválida' }),
    ]

    it('lets both the admin and the buyer correct an SRI rejection', () => {
      expect(toOrderInvoice([row()], sriRejected())?.canCorrect).toBe(true)
      const mine = toMyOrderInvoice([row()], sriRejected())
      expect(mine?.state).toBe('rejected')
      expect(mine?.canCorrect).toBe(true)
    })

    it('lets only the admin correct an intake rejection, which the buyer sees in process', () => {
      const admin = toOrderInvoice(intakeRejected(), [])
      expect(admin?.canCorrect).toBe(true)
      expect(admin?.rejection).toEqual({
        source: 'intake',
        messages: ['Identificación inválida'],
      })

      const mine = toMyOrderInvoice(intakeRejected(), [])
      expect(mine?.state).toBe('in_process')
      expect(mine?.canCorrect).toBe(false)
      expect(mine?.rejectionMessages).toEqual([])
    })

    it('lets nobody correct while a correction is pending', () => {
      const rows = [row(), row({ status: 'pending' })]
      expect(toOrderInvoice(rows, sriRejected())?.canCorrect).toBe(false)
      expect(toMyOrderInvoice(rows, sriRejected())?.canCorrect).toBe(false)
    })
  })

  describe('current sale reference', () => {
    it('marks the documents of the current reference apart from the earlier ones', () => {
      const rows = [row(), annul(), row({ externalRef: 'order-1-2' })]
      const documents = [
        document({ state: 'cancelled', authorizedAt: null }),
        document({ externalRef: 'order-1-2', issueDate: '2026-11-05' }),
      ]

      for (const invoice of [toOrderInvoice(rows, documents), toMyOrderInvoice(rows, documents)]) {
        expect(invoice?.state).toBe('authorized')
        expect(invoice?.documents.map((entry) => entry.current)).toEqual([true, false])
      }
    })
  })

  describe('document order', () => {
    const rows = [
      row(),
      annul(),
      row({ externalRef: 'order-1-2' }),
      annul({ externalRef: 'order-1-2' }),
      row({ externalRef: 'order-1-3' }),
    ]
    const documents = [
      document({ type: 'credit_note', number: '001-001-000000002', state: 'authorized' }),
      document({ externalRef: 'order-1-3', number: '001-001-000000016' }),
      document({ externalRef: 'order-1-2', number: '001-001-000000014', state: 'annulled' }),
      document({ number: '001-001-000000009', state: 'annulled' }),
      document({ externalRef: 'order-1-2', type: 'credit_note', number: '001-001-000000003' }),
    ]

    it('leads with the current invoice and keeps each annulled invoice next to its credit note, newest sale first', () => {
      for (const invoice of [toOrderInvoice(rows, documents), toMyOrderInvoice(rows, documents)]) {
        expect(invoice?.documents.map((entry) => entry.number)).toEqual([
          '001-001-000000016',
          '001-001-000000014',
          '001-001-000000003',
          '001-001-000000009',
          '001-001-000000002',
        ])
      }
    })

    it('does not depend on the order the documents were cached in', () => {
      const reversed = [...documents].reverse()
      expect(toOrderInvoice(rows, reversed)?.documents.map((entry) => entry.number)).toEqual(
        toOrderInvoice(rows, documents)?.documents.map((entry) => entry.number),
      )
    })
  })

  describe('resendable', () => {
    it('offers resending authorized documents only, never an annulled invoice', () => {
      const rows = [row(), annul()]
      const documents = [
        document({ state: 'annulled' }),
        document({ type: 'credit_note', state: 'authorized' }),
      ]

      const invoice = toOrderInvoice(rows, documents)

      expect(
        invoice?.documents.map((entry) => [entry.type, entry.downloadable, entry.resendable]),
      ).toEqual([
        ['invoice', true, false],
        ['credit_note', true, true],
      ])
    })
  })

  it('returns no invoice for an order that never asked for one', () => {
    expect(toOrderInvoice([], [])).toBeNull()
    expect(toMyOrderInvoice([row({ status: 'suppressed' })], [])).toBeNull()
  })
})
