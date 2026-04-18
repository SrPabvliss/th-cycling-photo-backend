import {
  AddToCartCommand,
  AddToCartDto,
  CheckoutCartCommand,
  CheckoutCartDto,
  MergeCartCommand,
  MergeCartDto,
  RemoveFromCartCommand,
} from '@cart/application/commands'
import type { CartViewProjection } from '@cart/application/projections'
import {
  CartSummaryProjection,
  CartViewEventGroupProjection,
  CheckoutResultProjection,
  MergeResultProjection,
} from '@cart/application/projections'
import { GetCartQuery } from '@cart/application/queries'
import { Body, Controller, Delete, Get, Param, Post, Query, Req } from '@nestjs/common'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import { JwtService } from '@nestjs/jwt'
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import { CurrentUser, type ICurrentUser, Public, Roles } from '@shared/auth'
import { ApiEnvelopeErrorResponse, ApiEnvelopeResponse, SuccessMessage } from '@shared/http'
import type { Request } from 'express'

@ApiTags('Cart')
@ApiBearerAuth()
@Controller('cart')
export class CartController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly jwtService: JwtService,
  ) {}

  /** Try to extract user from Authorization header without failing if absent. */
  private tryExtractUser(req: Request): ICurrentUser | null {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) return null
    try {
      const token = authHeader.split(' ')[1]
      const payload = this.jwtService.verify(token)
      return { userId: payload.sub, email: payload.email, role: payload.role }
    } catch {
      return null
    }
  }

  @Public()
  @Get()
  @SuccessMessage('success.FETCHED', { entity: 'entities.cart' })
  @ApiOperation({ summary: 'Get the current cart (authenticated or anonymous)' })
  @ApiQuery({ name: 'sessionId', required: false, description: 'Session ID for anonymous carts' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Cart contents',
    type: CartViewEventGroupProjection,
    isArray: true,
  })
  async getCart(
    @Req() req: Request,
    @Query('sessionId') sessionId?: string,
  ): Promise<CartViewProjection> {
    const user = this.tryExtractUser(req)
    const query = new GetCartQuery(user?.userId ?? null, sessionId ?? null)
    return this.queryBus.execute(query)
  }

  @Public()
  @Post('items')
  @SuccessMessage('success.CREATED', { entity: 'entities.cart' })
  @ApiOperation({ summary: 'Add a photo to the cart' })
  @ApiEnvelopeResponse({
    status: 201,
    description: 'Item added to cart',
    type: CartSummaryProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Photo not found' })
  async addItem(@Req() req: Request, @Body() dto: AddToCartDto): Promise<CartSummaryProjection> {
    const user = this.tryExtractUser(req)
    const command = new AddToCartCommand(dto.photoId, user?.userId ?? null, dto.sessionId ?? null)
    return this.commandBus.execute(command)
  }

  @Public()
  @Delete('items/:photoId')
  @SuccessMessage('success.DELETED', { entity: 'entities.cart' })
  @ApiOperation({ summary: 'Remove a photo from the cart' })
  @ApiQuery({ name: 'sessionId', required: false, description: 'Session ID for anonymous carts' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Item removed from cart',
    type: CartSummaryProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 422, description: 'No active cart found' })
  async removeItem(
    @Req() req: Request,
    @Param('photoId') photoId: string,
    @Query('sessionId') sessionId?: string,
  ): Promise<CartSummaryProjection> {
    const user = this.tryExtractUser(req)
    const command = new RemoveFromCartCommand(photoId, user?.userId ?? null, sessionId ?? null)
    return this.commandBus.execute(command)
  }

  @Post('merge')
  @SuccessMessage('success.UPDATED', { entity: 'entities.cart' })
  @ApiOperation({ summary: 'Merge anonymous cart into authenticated user cart' })
  @ApiEnvelopeResponse({ status: 200, description: 'Cart merged', type: MergeResultProjection })
  async merge(
    @CurrentUser() user: ICurrentUser,
    @Body() dto: MergeCartDto,
  ): Promise<MergeResultProjection> {
    const command = new MergeCartCommand(user.userId, dto.sessionId)
    return this.commandBus.execute(command)
  }

  @Roles('customer')
  @Post('checkout')
  @SuccessMessage('success.CREATED', { entity: 'entities.order' })
  @ApiOperation({ summary: 'Checkout the cart — creates orders per event' })
  @ApiEnvelopeResponse({
    status: 201,
    description: 'Orders created from cart checkout',
    type: CheckoutResultProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 422, description: 'Cart empty or checkout failed' })
  async checkout(
    @CurrentUser() user: ICurrentUser,
    @Body() dto: CheckoutCartDto,
  ): Promise<CheckoutResultProjection> {
    const command = new CheckoutCartCommand(
      user.userId,
      dto.items.map((i) => ({
        eventId: i.eventId,
        bibNumber: i.bibNumber ?? null,
        snapCategoryName: i.snapCategoryName ?? null,
      })),
    )
    return this.commandBus.execute(command)
  }
}
