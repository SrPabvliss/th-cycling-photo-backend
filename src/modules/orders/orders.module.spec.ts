import { OrderAccountController } from '@orders/presentation/controllers/order-account.controller'
import { OrdersController } from '@orders/presentation/controllers/orders.controller'
import { OrdersModule } from './orders.module'

describe('OrdersModule controller registration order', () => {
  it('registers OrderAccountController before OrdersController so GET /orders/me does not fall into the admin GET /orders/:id route', () => {
    const controllers: unknown[] = Reflect.getMetadata('controllers', OrdersModule)

    const accountIndex = controllers.indexOf(OrderAccountController)
    const adminIndex = controllers.indexOf(OrdersController)

    expect(accountIndex).toBeGreaterThanOrEqual(0)
    expect(adminIndex).toBeGreaterThanOrEqual(0)

    if (accountIndex >= adminIndex) {
      throw new Error(
        'OrderAccountController must be registered before OrdersController in orders.module.ts. ' +
          'Nest matches routes in registration order, and OrdersController exposes an admin-only ' +
          'GET /orders/:id guarded by the order.read permission. If OrdersController comes first, ' +
          "GET /orders/me resolves to GET /orders/:id with id = 'me', and every customer gets a 403.",
      )
    }
  })
})
