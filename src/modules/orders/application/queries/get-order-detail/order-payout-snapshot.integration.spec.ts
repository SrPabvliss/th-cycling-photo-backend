import { EventPayoutMethod } from '@events/domain/entities'
import {
  EVENT_PAYOUT_METHOD_REPOSITORY,
  type IEventPayoutMethodRepository,
} from '@events/domain/ports'
import { EventPayoutMethodRepository } from '@events/infrastructure/repositories/event-payout-method.repository'
import { ConfigModule } from '@nestjs/config'
import { Test, type TestingModule } from '@nestjs/testing'
import { ORDER_READ_REPOSITORY } from '@orders/domain/ports'
import { OrderReadRepository } from '@orders/infrastructure/repositories/order-read.repository'
import { AUTHORIZATION_SERVICE } from '@shared/authorization/domain/ports/authorization.service.port'
import { AUTHORIZATION_CACHE } from '@shared/authorization/domain/ports/authorization-cache.port'
import { PERMISSION_REPOSITORY } from '@shared/authorization/domain/ports/permission-repository.port'
import { AuthorizationService } from '@shared/authorization/infrastructure/authorization.service'
import { RequestScopedAuthorizationCache } from '@shared/authorization/infrastructure/cache/request-scoped-authorization.cache'
import { PermissionRepository } from '@shared/authorization/infrastructure/repositories/permission.repository'
import { CdnUrlBuilder } from '@shared/cloudflare/infrastructure/cdn-url.builder'
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service'
import { TenantPayoutMethod } from '@tenants/domain/entities/tenant-payout-method.entity'
import { TenantPayoutMethodRepository } from '@tenants/infrastructure/repositories/tenant-payout-method.repository'
import configuration from '../../../../../config/configuration'
import { validate } from '../../../../../config/env.validation'
import { GetOrderDetailHandler } from './get-order-detail.handler'
import { GetOrderDetailQuery } from './get-order-detail.query'

describe('order payout snapshot', () => {
  let module: TestingModule
  let prisma: PrismaService
  let handler: GetOrderDetailHandler
  let tenantPayoutRepo: TenantPayoutMethodRepository
  let eventPayoutRepo: IEventPayoutMethodRepository

  let tenant: { id: string }
  let user: { id: string }
  let event: { id: string }
  let order: { id: string }
  let bankMethod: TenantPayoutMethod

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          envFilePath: [`.env.${process.env.NODE_ENV || 'development'}`, '.env'],
          validate,
          load: [configuration],
          isGlobal: true,
        }),
      ],
      providers: [
        PrismaService,
        { provide: PERMISSION_REPOSITORY, useClass: PermissionRepository },
        { provide: AUTHORIZATION_CACHE, useClass: RequestScopedAuthorizationCache },
        AuthorizationService,
        { provide: AUTHORIZATION_SERVICE, useExisting: AuthorizationService },
        { provide: ORDER_READ_REPOSITORY, useClass: OrderReadRepository },
        { provide: EVENT_PAYOUT_METHOD_REPOSITORY, useClass: EventPayoutMethodRepository },
        TenantPayoutMethodRepository,
        GetOrderDetailHandler,
        {
          provide: CdnUrlBuilder,
          useValue: {
            buildPublicUrl: () => 'http://fake',
            buildWatermarkedUrl: () => 'http://fake',
            buildSecureUrl: () => 'http://fake',
            assetUrl: () => 'http://fake',
            internalUrl: () => 'http://fake',
          },
        },
      ],
    }).compile()

    prisma = module.get(PrismaService)
    handler = module.get(GetOrderDetailHandler)
    tenantPayoutRepo = module.get(TenantPayoutMethodRepository)
    eventPayoutRepo = module.get(EVENT_PAYOUT_METHOD_REPOSITORY)

    tenant = await prisma.tenant.create({
      data: { name: 'Snapshot Tenant', is_platform: false, public_name: 'Snapshot Public' },
    })

    const tenantTpl = await prisma.permissionTemplate.findUniqueOrThrow({
      where: { key: 'tenant' },
    })
    user = await prisma.user.create({
      data: {
        email: `snapshot-${crypto.randomUUID()}@t.com`,
        password_hash: 'x',
        permission_template_id: tenantTpl.id,
        tenant_id: tenant.id,
      },
    })

    const evtType = await prisma.eventType.findFirstOrThrow()
    event = await prisma.event.create({
      data: {
        name: 'Snapshot Event',
        slug: `snapshot-${crypto.randomUUID()}`,
        start_date: new Date(),
        end_date: new Date(),
        tenant_id: tenant.id,
        event_type_id: evtType.id,
      },
    })

    bankMethod = TenantPayoutMethod.createBankTransfer(
      tenant.id,
      {
        bankName: 'Banco Pichincha',
        accountNumber: 'ORIGINAL-123',
        accountType: 'savings',
        accountHolder: 'Snapshot Holder',
        holderIdentification: '1710000000',
      },
      user.id,
    )
    await tenantPayoutRepo.save(bankMethod)

    await eventPayoutRepo.replaceForEvent(event.id, [
      EventPayoutMethod.copyFrom(event.id, bankMethod),
    ])

    const orderId = crypto.randomUUID()
    await prisma.$executeRawUnsafe(
      `INSERT INTO orders (id, event_id, user_id, status) VALUES ('${orderId}', '${event.id}', '${user.id}', 'pending')`,
    )
    order = { id: orderId }

    // Mutating the tenant's payout method after the event copy exists is what proves the snapshot, not an echo.
    bankMethod.updateBankDetails({
      bankName: 'Banco Pichincha',
      accountNumber: 'CHANGED-999',
      accountType: 'savings',
      accountHolder: 'Snapshot Holder',
      holderIdentification: '1710000000',
    })
    await tenantPayoutRepo.save(bankMethod)
  })

  afterAll(async () => {
    if (prisma) {
      await prisma.$executeRawUnsafe(`DELETE FROM orders WHERE id = '${order?.id}'`)
      await prisma.eventPayoutMethod.deleteMany({ where: { event_id: event?.id } })
      await prisma.event.deleteMany({ where: { id: event?.id } })
      await prisma.tenantPayoutMethod.deleteMany({ where: { tenant_id: tenant?.id } })
      await prisma.user.deleteMany({ where: { id: user?.id } })
      await prisma.tenant.deleteMany({ where: { id: tenant?.id } })
      await prisma.$disconnect()
    }
    if (module) {
      await module.close()
    }
  })

  it('keeps the order payout snapshot frozen after the tenant profile changes', async () => {
    const detail = await handler.execute(new GetOrderDetailQuery(order.id, user.id))

    expect(detail.payoutMethods?.[0].accountNumber).toBe('ORIGINAL-123')
  })
})
