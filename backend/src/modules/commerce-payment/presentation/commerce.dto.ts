import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateOrderDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  planId!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  targetLicenseId?: string;
}

export class AcceptServiceTermsDto {
  @ApiProperty({ enum: [true] })
  @IsIn([true])
  accepted!: true;
}

export class ReviewPaymentDto {
  @ApiProperty({ enum: ['RESOLVED', 'CLOSED_NO_ACTION'] })
  @IsIn(['RESOLVED', 'CLOSED_NO_ACTION'])
  status!: 'CLOSED_NO_ACTION' | 'RESOLVED';

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(1_000)
  reason!: string;
}

const ORDER_STATUSES = [
  'WAITING_SERVICE_TERMS_ACCEPTANCE',
  'WAITING_PAYMENT',
  'PAYMENT_ACCEPTED',
  'CANCELLED',
  'EXPIRED',
] as const;
const PAYMENT_CLASSIFICATIONS = [
  'MATCHED',
  'DUPLICATE',
  'UNMATCHED',
  'AMOUNT_MISMATCH',
  'INVALID',
] as const;

export class OrderDto {
  @ApiProperty() billingCycleSnapshot!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty() currency!: string;
  @ApiProperty({ format: 'uuid' }) customerUserId!: string;
  @ApiProperty() durationMonthsSnapshot!: number;
  @ApiProperty({ type: Object }) entitlementsSnapshot!: Record<string, unknown>;
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true, type: String })
  licenseId!: string | null;
  @ApiProperty() maxActiveDevicesSnapshot!: number;
  @ApiProperty() orderNumber!: string;
  @ApiProperty({ enum: ORDER_STATUSES }) orderStatus!: (typeof ORDER_STATUSES)[number];
  @ApiProperty({ enum: ['NEW_PURCHASE', 'RENEWAL'] })
  orderType!: 'NEW_PURCHASE' | 'RENEWAL';
  @ApiProperty({ format: 'date-time' }) paymentDueAt!: string;
  @ApiProperty({ pattern: '^0x[0-9a-fA-F]{64}$' }) planCommitmentSnapshot!: string;
  @ApiProperty({ format: 'uuid' }) planId!: string;
  @ApiProperty() planNameSnapshot!: string;
  @ApiProperty() planVersionSnapshot!: number;
  @ApiProperty() priceVndSnapshot!: number;
  @ApiProperty({ format: 'uuid' }) productId!: string;
  @ApiProperty() productNameSnapshot!: string;
  @ApiProperty() providerNameSnapshot!: string;
  @ApiProperty({ format: 'uuid' }) providerUserId!: string;
  @ApiPropertyOptional({ nullable: true, type: String })
  publicLicenseId!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true, type: String })
  targetLicenseId!: string | null;
  @ApiPropertyOptional({ format: 'date-time', nullable: true, type: String })
  serviceTermsAcceptedAt!: string | null;
}

export class OrderTermsDto {
  @ApiProperty() content!: string;
}

export class CheckoutSessionDto {
  @ApiProperty() amountVnd!: number;
  @ApiProperty({ format: 'uuid' }) attemptId!: string;
  @ApiProperty({ additionalProperties: { type: 'string' }, type: 'object' })
  checkoutFields!: Record<string, string>;
  @ApiProperty({ enum: ['POST'] }) checkoutMethod!: 'POST';
  @ApiProperty() checkoutReference!: string;
  @ApiProperty({ format: 'uri' }) checkoutUrl!: string;
  @ApiProperty({ format: 'date-time' }) expiresAt!: string;
  @ApiProperty() expiresWithOrder!: boolean;
}

export class PaymentIngestResultDto {
  @ApiPropertyOptional() activationRequired?: boolean;
  @ApiProperty({ enum: PAYMENT_CLASSIFICATIONS })
  classification!: (typeof PAYMENT_CLASSIFICATIONS)[number];
  @ApiPropertyOptional({ format: 'uuid' }) commandId?: string;
  @ApiPropertyOptional({ format: 'uuid' }) licenseId?: string;
  @ApiProperty({ format: 'uuid' }) transactionId!: string;
}

export class PaymentHistoryDto {
  @ApiProperty() amountVnd!: number;
  @ApiProperty({ enum: PAYMENT_CLASSIFICATIONS }) classification!: string;
  @ApiProperty({ format: 'uuid' }) orderId!: string;
  @ApiProperty() orderNumber!: string;
  @ApiProperty({ enum: ['NEW_PURCHASE', 'RENEWAL'] })
  orderType!: 'NEW_PURCHASE' | 'RENEWAL';
  @ApiProperty() planNameSnapshot!: string;
  @ApiProperty() productNameSnapshot!: string;
  @ApiProperty() providerEventId!: string;
  @ApiPropertyOptional({ nullable: true, type: String })
  providerTransactionReference!: string | null;
  @ApiProperty({ format: 'date-time' }) receivedAt!: string;
  @ApiPropertyOptional({ nullable: true, type: String }) reviewStatus!: string | null;
  @ApiProperty({ format: 'uuid' }) transactionId!: string;
}

export class PaymentReceiptDto {
  @ApiProperty() amountVnd!: number;
  @ApiProperty() currency!: string;
  @ApiProperty({ format: 'uuid' }) orderId!: string;
  @ApiProperty() orderNumber!: string;
  @ApiProperty({ enum: ['NEW_PURCHASE', 'RENEWAL'] })
  orderType!: 'NEW_PURCHASE' | 'RENEWAL';
  @ApiProperty({ format: 'date-time' }) paidAt!: string;
  @ApiProperty() planNameSnapshot!: string;
  @ApiProperty() productNameSnapshot!: string;
  @ApiProperty() providerNameSnapshot!: string;
  @ApiPropertyOptional({ nullable: true, type: String })
  providerTransactionReference!: string | null;
  @ApiProperty({ format: 'uuid' }) transactionId!: string;
}

export class PaymentReviewDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: PAYMENT_CLASSIFICATIONS }) classification!: string;
  @ApiProperty() amountVnd!: number;
  @ApiProperty() providerEventId!: string;
  @ApiPropertyOptional({ nullable: true, type: String })
  providerTransactionReference!: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) reviewReason!: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) reviewStatus!: string | null;
  @ApiProperty({ format: 'date-time' }) receivedAt!: string;
  @ApiPropertyOptional({ format: 'date-time', nullable: true, type: String })
  reviewedAt?: string | null;
}
