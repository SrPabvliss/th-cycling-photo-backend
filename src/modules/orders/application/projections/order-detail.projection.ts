import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class OrderPayoutMethodProjection {
  @ApiProperty() provider: string
  @ApiProperty() isActive: boolean
  @ApiProperty() sortOrder: number
  @ApiPropertyOptional({ nullable: true }) receiverIdentifier: string | null
  @ApiPropertyOptional({ nullable: true }) bankName: string | null
  @ApiPropertyOptional({ nullable: true }) accountNumber: string | null
  @ApiPropertyOptional({ nullable: true }) accountType: string | null
  @ApiPropertyOptional({ nullable: true }) accountHolder: string | null
  @ApiPropertyOptional({ nullable: true }) holderIdentification: string | null
}

export class OrderPhotoProjection {
  id: string
  filename: string
  publicSlug: string
  thumbnailUrl: string
  fullUrl: string
}

export class OrderDeliveryLinkProjection {
  token: string
  status: string
  expiresAt: Date
  downloadCount: number
}

export class OrderDetailProjection {
  /** Order UUID */
  id: string
  /** Current status */
  status: string
  /** Optional notes */
  notes: string | null
  /** When the order was created */
  createdAt: Date
  /** When the admin sent payment info to the customer */
  notifiedAt: Date | null
  /** When payment was confirmed */
  paidAt: Date | null
  /** When photos were delivered */
  deliveredAt: Date | null
  /** When the order was cancelled */
  cancelledAt: Date | null
  /** User display name (from user relation) */
  userName: string
  /** Snap first name at time of order */
  snapFirstName: string | null
  /** Snap last name at time of order */
  snapLastName: string | null
  /** Snap WhatsApp at time of order */
  snapWhatsapp: string | null
  customerPrimaryPhone: string | null
  /** Snap email at time of order */
  snapEmail: string | null
  eventId: string
  /** Event name */
  eventName: string
  /** Tenant that owns the order's event. Shown to TitanTV only. */
  organizerName: string
  /** Order subtotal (Decimal serialized as string to preserve precision) */
  subtotal: string | null
  /** Currency code snapshot at time of order (e.g. USD) */
  snapCurrency: string | null
  paymentMethod: string | null
  @ApiPropertyOptional({ type: [OrderPayoutMethodProjection] })
  payoutMethods?: OrderPayoutMethodProjection[]
  /** Preview link token that originated this order (nullable) */
  previewLinkToken: string | null
  /** Retouch progress for the order */
  retouchProgress: { total: number; retouched: number }
  /** Photos in the order */
  photos: OrderPhotoProjection[]
  /** Delivery link (null if not yet generated) */
  deliveryLink: OrderDeliveryLinkProjection | null
}
