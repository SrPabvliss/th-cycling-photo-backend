import type { InvoiceSource } from './ports/invoice-source-reader.port'
import {
  type RikuchiyEmissionLine,
  type RikuchiyEmissionPayload,
  SRI_ID_TYPE,
} from './rikuchiy-emission-payload'

export type EmissionSkipReason =
  | 'not_a_sale'
  | 'no_billing_data'
  | 'no_invoice_consent'
  | 'missing_unit_price'
  | 'total_mismatch'

export type EmissionBuild =
  | { kind: 'payload'; payload: RikuchiyEmissionPayload }
  | { kind: 'skip'; reason: EmissionSkipReason }

const SALE_STATUSES = new Set(['paid', 'delivered'])
const AMOUNT = /^(\d+)\.(\d{2})$/

export class RikuchiyEmission {
  static readonly APP = 'cycling-photo'
  static readonly PAYMENT_METHOD = '20'
  static readonly LINE_CODE = 'FOTO'
  static readonly LINE_DESCRIPTION = 'Fotografía digital'

  static build(source: InvoiceSource, emissionId: string): EmissionBuild {
    const subtotalCents =
      source.subtotal === null ? null : RikuchiyEmission.toCents(source.subtotal)
    if (!SALE_STATUSES.has(source.status) || subtotalCents === null || subtotalCents <= 0) {
      return { kind: 'skip', reason: 'not_a_sale' }
    }
    if (source.billing === null) return { kind: 'skip', reason: 'no_billing_data' }
    if (source.consent === null || source.consent.ip === null) {
      return { kind: 'skip', reason: 'no_invoice_consent' }
    }

    const prices = source.items.map((item) => item.unitPrice)
    if (prices.some((price) => price === null)) {
      return { kind: 'skip', reason: 'missing_unit_price' }
    }

    const linesCents = prices.reduce<number>(
      (sum, price) => sum + (RikuchiyEmission.toCents(price as string) ?? Number.NaN),
      0,
    )
    if (linesCents !== subtotalCents) return { kind: 'skip', reason: 'total_mismatch' }

    return {
      kind: 'payload',
      payload: {
        emissionId,
        sale: { app: RikuchiyEmission.APP, externalRef: source.orderId },
        buyer: {
          idType: SRI_ID_TYPE[source.billing.idType],
          idNumber: source.billing.idNumber,
          legalName: source.billing.legalName,
          address: source.billing.address,
          email: source.billing.email,
          phone: null,
        },
        lines: source.items.map((item) => RikuchiyEmission.lineOf(item)),
        additionalInfo: [
          { name: 'Evento', value: source.eventName },
          { name: 'Fecha del evento', value: RikuchiyEmission.calendarDayOf(source.eventDate) },
          { name: 'Pedido', value: source.orderId.slice(0, 8) },
        ],
        total: RikuchiyEmission.fromCents(linesCents),
        paymentMethod: RikuchiyEmission.PAYMENT_METHOD,
        consent: { givenAt: source.consent.givenAt.toISOString(), ip: source.consent.ip },
      },
    }
  }

  private static lineOf(item: InvoiceSource['items'][number]): RikuchiyEmissionLine {
    return {
      code: RikuchiyEmission.LINE_CODE,
      description: RikuchiyEmission.LINE_DESCRIPTION,
      quantity: 1,
      grossPrice: item.unitPrice as string,
      additionalDetails: [{ name: 'Archivo', value: item.filename.replace(/\.[^.]+$/, '') }],
    }
  }

  private static toCents(amount: string): number | null {
    const match = AMOUNT.exec(amount)
    if (!match) return null
    return Number(match[1]) * 100 + Number(match[2])
  }

  private static fromCents(cents: number): string {
    return `${Math.trunc(cents / 100)}.${String(cents % 100).padStart(2, '0')}`
  }

  private static calendarDayOf(date: Date): string {
    const day = String(date.getUTCDate()).padStart(2, '0')
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    return `${day}/${month}/${date.getUTCFullYear()}`
  }
}
