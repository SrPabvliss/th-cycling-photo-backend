import { AuthModule } from '@auth/auth.module'
import { AddToCartHandler } from '@cart/application/commands/add-to-cart/add-to-cart.handler'
import { CheckoutCartHandler } from '@cart/application/commands/checkout-cart/checkout-cart.handler'
import { MergeCartHandler } from '@cart/application/commands/merge-cart/merge-cart.handler'
import { RemoveFromCartHandler } from '@cart/application/commands/remove-from-cart/remove-from-cart.handler'
import { GetCartHandler } from '@cart/application/queries/get-cart/get-cart.handler'
import { CART_READ_REPOSITORY, CART_WRITE_REPOSITORY } from '@cart/domain/ports'
import { CartReadRepository } from '@cart/infrastructure/repositories/cart-read.repository'
import { CartWriteRepository } from '@cart/infrastructure/repositories/cart-write.repository'
import { CartController } from '@cart/presentation/controllers/cart.controller'
import { forwardRef, Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'
import { OrdersModule } from '@orders/orders.module'
import { PhotosModule } from '@photos/photos.module'

const CommandHandlers = [
  AddToCartHandler,
  RemoveFromCartHandler,
  MergeCartHandler,
  CheckoutCartHandler,
]
const QueryHandlers = [GetCartHandler]

@Module({
  imports: [
    CqrsModule,
    forwardRef(() => AuthModule),
    forwardRef(() => OrdersModule),
    forwardRef(() => PhotosModule),
  ],
  controllers: [CartController],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
    { provide: CART_READ_REPOSITORY, useClass: CartReadRepository },
    { provide: CART_WRITE_REPOSITORY, useClass: CartWriteRepository },
  ],
  exports: [CART_READ_REPOSITORY, CART_WRITE_REPOSITORY],
})
export class CartModule {}
