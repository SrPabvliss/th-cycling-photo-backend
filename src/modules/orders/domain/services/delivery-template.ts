export interface DeliveryTemplateContext {
  customerFirstName: string
  photoCount: number
  deliveryUrl: string
}

export type DeliveryTemplateVariant = 'first' | 'regenerated' | 'resend'

const OPENING: Record<DeliveryTemplateVariant, (name: string) => string> = {
  first: (name) => `¡Muchas gracias ${name}! Tu pago fue confirmado.`,
  regenerated: (name) => `¡Hola ${name}! Te enviamos un nuevo enlace de descarga.`,
  resend: (name) => `¡Hola ${name}! Te reenviamos el enlace de descarga.`,
}

/**
 * One text for the three ways an operator hands over the photos. It used to live in three places —
 * two backend handlers and the browser — which drifted apart, so the same order read differently
 * depending on which button was pressed.
 *
 * No emoji: the WhatsApp prefill endpoint mangled them on some platforms and buyers received
 * replacement characters. Same reason as the payment-info template.
 */
export function buildDeliveryTemplate(
  context: DeliveryTemplateContext,
  variant: DeliveryTemplateVariant,
): string {
  const photos = `${context.photoCount} ${context.photoCount === 1 ? 'foto' : 'fotos'}`

  return [
    OPENING[variant](context.customerFirstName),
    `Aquí tienes tus ${photos} en alta calidad: ${context.deliveryUrl}`,
    'El enlace estará disponible por 7 días.',
    '¡Gracias!',
  ].join(' ')
}
