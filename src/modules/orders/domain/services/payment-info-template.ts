export interface BankAccountForBuyer {
  bankName: string | null
  accountType: string | null
  accountNumber: string | null
  accountHolder: string | null
  holderIdentification: string | null
}

export interface PaymentInfoContext {
  customerFirstName: string
  eventName: string
  photoCount: number
  subtotal: number | null
  currency: string | null
  account: BankAccountForBuyer | null
}

const PRICE_PLACEHOLDER = '$[ESCRIBE EL PRECIO AQUÍ]'

function formatPrice(subtotal: number | null, currency: string | null): string {
  if (subtotal === null) return `El valor a pagar es de ${PRICE_PLACEHOLDER}.`
  const symbol = (currency ?? 'USD') === 'USD' ? '$' : `${currency} `
  return `El valor a pagar es de ${symbol}${subtotal.toFixed(2)}.`
}

/**
 * The account the buyer is told to transfer to has to be the one frozen on the event, never a
 * platform-wide default: an organiser's sale must land in the organiser's account. When the event
 * carries no bank account the message says so instead of inventing one — sending someone else's
 * account number is worse than sending none.
 *
 * No emoji on purpose: WhatsApp's URL prefill mangles a chunk of them on some platforms and they
 * reached buyers as replacement characters.
 */
export function buildPaymentInfoTemplate(context: PaymentInfoContext): string {
  const account = context.account

  const accountLines = account
    ? [
        'Datos para realizar el pago:',
        `- Banco: ${account.bankName ?? '-'}`,
        `- Tipo de cuenta: ${account.accountType ?? '-'}`,
        `- Número: ${account.accountNumber ?? '-'}`,
        `- Titular: ${account.accountHolder ?? '-'}`,
        `- Cédula: ${account.holderIdentification ?? '-'}`,
      ]
    : ['Te compartimos los datos para la transferencia en un momento.']

  return [
    `Hola ${context.customerFirstName},`,
    '',
    `Recibimos tu orden de ${context.photoCount} fotos del evento "${context.eventName}".`,
    '',
    formatPrice(context.subtotal, context.currency),
    '',
    ...accountLines,
    '',
    'Cuando realices el pago, por favor envíanos el comprobante por este medio.',
    '',
    'Gracias.',
  ].join('\n')
}
