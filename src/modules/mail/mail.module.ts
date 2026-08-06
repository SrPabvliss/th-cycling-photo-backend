import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { MailService } from './application/services/mail.service'
import { MAILER, TEMPLATE_RENDERER } from './domain/ports'
import { SmtpMailerAdapter } from './infrastructure/adapters/smtp-mailer.adapter'
import { EmailDeliveryProcessor } from './infrastructure/processors/email-delivery.processor'
import { HtmlTemplateRenderer } from './infrastructure/renderers/html-template.renderer'

@Module({
  imports: [BullModule.registerQueue({ name: 'email-delivery' })],
  providers: [
    MailService,
    EmailDeliveryProcessor,
    { provide: MAILER, useClass: SmtpMailerAdapter },
    { provide: TEMPLATE_RENDERER, useClass: HtmlTemplateRenderer },
  ],
  exports: [MailService],
})
export class MailModule {}
