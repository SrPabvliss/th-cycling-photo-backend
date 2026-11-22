import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { CqrsModule } from '@nestjs/cqrs'
import type { IYupanaOutboxRepository } from '@shared/yupana/domain/ports'
import { YUPANA_OUTBOX_REPOSITORY } from '@shared/yupana/domain/ports'
import { SendCommunityTestHandler } from './application/commands/send-community-test/send-community-test.handler'
import { UnsubscribeCommunityHandler } from './application/commands/unsubscribe-community/unsubscribe-community.handler'
import { CommunityEmailService } from './application/services/community-email.service'
import { MailService } from './application/services/mail.service'
import { COMMUNITY_AUDIENCE_REPOSITORY, UNSUBSCRIBE_TOKEN_SERVICE } from './domain/community'
import { MAILER, TEMPLATE_RENDERER } from './domain/ports'
import { CloudflareApiMailerAdapter } from './infrastructure/adapters/cloudflare-api-mailer.adapter'
import { MailRedirectDecorator } from './infrastructure/adapters/mail-redirect.decorator'
import { SmtpMailerAdapter } from './infrastructure/adapters/smtp-mailer.adapter'
import {
  COMMUNITY_CAMPAIGNS_QUEUE,
  COMMUNITY_EMAIL_DELIVERY_QUEUE,
  CommunityCampaignProcessor,
} from './infrastructure/processors/community-campaign.processor'
import { CommunityEmailDeliveryProcessor } from './infrastructure/processors/community-email-delivery.processor'
import { EmailDeliveryProcessor } from './infrastructure/processors/email-delivery.processor'
import { HtmlTemplateRenderer } from './infrastructure/renderers/html-template.renderer'
import { CommunityAudienceRepository } from './infrastructure/repositories/community-audience.repository'
import { CommunityCampaignSchedulerService } from './infrastructure/services/community-campaign-scheduler.service'
import { UnsubscribeTokenService } from './infrastructure/services/unsubscribe-token.service'
import { MailController } from './presentation/controllers/mail.controller'

@Module({
  imports: [
    CqrsModule,
    BullModule.registerQueue(
      { name: 'email-delivery' },
      { name: COMMUNITY_CAMPAIGNS_QUEUE },
      { name: COMMUNITY_EMAIL_DELIVERY_QUEUE },
    ),
  ],
  controllers: [MailController],
  providers: [
    MailService,
    EmailDeliveryProcessor,
    {
      provide: MAILER,
      useFactory: (config: ConfigService, yupanaOutbox: IYupanaOutboxRepository) => {
        const transport = config.get<string>('mail.transport', 'api')
        const redirectTo = config.get<string>('mail.redirectTo', '')
        const transportAdapter =
          transport === 'smtp'
            ? new SmtpMailerAdapter(config)
            : new CloudflareApiMailerAdapter(config, yupanaOutbox)
        return new MailRedirectDecorator(transportAdapter, redirectTo)
      },
      inject: [ConfigService, YUPANA_OUTBOX_REPOSITORY],
    },
    {
      provide: TEMPLATE_RENDERER,
      useFactory: (config: ConfigService) =>
        new HtmlTemplateRenderer(
          config.getOrThrow<string>('app.webBaseUrl'),
          config.get<string>('mail.assetsUrl', ''),
        ),
      inject: [ConfigService],
    },
    { provide: UNSUBSCRIBE_TOKEN_SERVICE, useClass: UnsubscribeTokenService },
    { provide: COMMUNITY_AUDIENCE_REPOSITORY, useClass: CommunityAudienceRepository },
    CommunityEmailService,
    CommunityCampaignProcessor,
    CommunityEmailDeliveryProcessor,
    CommunityCampaignSchedulerService,
    UnsubscribeCommunityHandler,
    SendCommunityTestHandler,
  ],
  exports: [MailService],
})
export class MailModule {}
