import { MailService } from '@mail/application/services/mail.service'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

export type DeliveryEmailKind = 'first' | 'regenerated'

export type DeliveryEmailData = {
  email: string | null
  firstName: string
  eventName: string
  photoCount: number
  subtotal: string | null
  currency: string | null
  deliveryUrl: string
  expiresAt: Date
}

const SUBJECTS: Record<DeliveryEmailKind, (eventName: string) => string> = {
  first: (eventName) => `Tus fotos de ${eventName} están listas`,
  regenerated: (eventName) => `Nuevo enlace para descargar tus fotos de ${eventName}`,
}

/**
 * Emails the buyer their delivery link: when the order is first delivered, and again whenever
 * staff regenerate it, because regenerating kills the link of the earlier email at once. An order
 * with no email on file, or a mail queue that refuses the job, is logged and never fails the
 * delivery itself.
 */
@Injectable()
export class DeliveryEmailService {
  private readonly logger = new Logger(DeliveryEmailService.name)
  private readonly webBaseUrl: string

  constructor(
    private readonly mailService: MailService,
    config: ConfigService,
  ) {
    this.webBaseUrl = config.getOrThrow<string>('app.webBaseUrl')
  }

  async send(kind: DeliveryEmailKind, data: DeliveryEmailData): Promise<void> {
    if (!data.email) {
      this.logger.warn(
        `Delivered an order with no email address on file. eventName=${data.eventName}`,
      )
      return
    }

    const total =
      data.subtotal === null ? '' : `${data.currency ?? 'USD'} ${Number(data.subtotal).toFixed(2)}`

    try {
      await this.mailService.enqueue({
        to: data.email,
        subject: SUBJECTS[kind](data.eventName),
        template: 'order-delivered',
        vars: {
          firstName: data.firstName,
          eventName: data.eventName,
          photoCount: String(data.photoCount),
          total,
          deliveryUrl: data.deliveryUrl,
          expiresOn: data.expiresAt.toLocaleDateString('es-EC', {
            day: 'numeric',
            month: 'long',
          }),
          logoUrl: `${this.webBaseUrl}/brand/logo-email.png`,
        },
      })
    } catch (error) {
      this.logger.error(
        `Delivered the order but could not enqueue its email. kind=${kind} reason=${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }
}
