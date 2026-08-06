import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { MailService } from './application/services/mail.service'
import { MAILER, TEMPLATE_RENDERER } from './domain/ports'
import { CloudflareApiMailerAdapter } from './infrastructure/adapters/cloudflare-api-mailer.adapter'
import { MailRedirectDecorator } from './infrastructure/adapters/mail-redirect.decorator'
import { SmtpMailerAdapter } from './infrastructure/adapters/smtp-mailer.adapter'
import { EmailDeliveryProcessor } from './infrastructure/processors/email-delivery.processor'
import { HtmlTemplateRenderer } from './infrastructure/renderers/html-template.renderer'

@Module({
  imports: [BullModule.registerQueue({ name: 'email-delivery' })],
  providers: [
    MailService,
    EmailDeliveryProcessor,
    {
      provide: MAILER,
      useFactory: (config: ConfigService) => {
        const transport = config.get<string>('mail.transport', 'api')
        const redirectTo = config.get<string>('mail.redirectTo', '')
        const transportAdapter =
          transport === 'smtp'
            ? new SmtpMailerAdapter(config)
            : new CloudflareApiMailerAdapter(config)
        return new MailRedirectDecorator(transportAdapter, redirectTo)
      },
      inject: [ConfigService],
    },
    { provide: TEMPLATE_RENDERER, useClass: HtmlTemplateRenderer },
  ],
  exports: [MailService],
})
export class MailModule {}
