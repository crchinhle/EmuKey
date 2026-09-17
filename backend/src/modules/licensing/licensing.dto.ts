import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ActivateDeviceDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  licenseId!: string;

  @ApiProperty({ pattern: '^0x[0-9a-fA-F]{64}$' })
  @IsString()
  @Matches(/^0x[0-9a-fA-F]{64}$/)
  activationKey!: `0x${string}`;

  @ApiProperty()
  @IsString()
  @MinLength(16)
  @MaxLength(128)
  challenge!: string;

  @ApiProperty({ minLength: 1, maxLength: 128 })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  deviceRef!: string;

  @ApiProperty({ description: 'EVM address corresponding to the device signing key' })
  @IsString()
  @Matches(/^0x[0-9a-fA-F]{40}$/)
  devicePublicKey!: `0x${string}`;

  @ApiProperty({ description: 'EIP-191 signature over the activation challenge' })
  @IsString()
  @Matches(/^0x[0-9a-fA-F]{130}$/)
  proof!: `0x${string}`;
}

export class RevokeDeviceDto {
  @ApiProperty({ minLength: 32 })
  @IsString()
  @MinLength(32)
  actionToken!: string;

  @ApiProperty({ pattern: '^0x[0-9a-fA-F]{64}$' })
  @IsString()
  @Matches(/^0x[0-9a-fA-F]{64}$/)
  activationKey!: `0x${string}`;

  @ApiProperty()
  @IsString()
  @MinLength(16)
  @MaxLength(128)
  challenge!: string;

  @ApiProperty({ description: 'EIP-191 signature over the revoke challenge' })
  @IsString()
  @Matches(/^0x[0-9a-fA-F]{130}$/)
  proof!: `0x${string}`;
}

export class RotateActivationKeyDto {
  @ApiProperty({ minLength: 32 })
  @IsString()
  @MinLength(32)
  actionToken!: string;

  @ApiProperty({ pattern: '^0x[0-9a-fA-F]{64}$' })
  @IsString()
  @Matches(/^0x[0-9a-fA-F]{64}$/)
  currentKey!: `0x${string}`;
}

export class LicensingActionVerificationDto {
  @ApiProperty({ enum: ['ROTATE_KEY', 'REVOKE_DEVICE'] })
  @IsIn(['ROTATE_KEY', 'REVOKE_DEVICE'])
  action!: 'ROTATE_KEY' | 'REVOKE_DEVICE';

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  licenseId!: string;
}

export class ActivationChallengeDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  licenseId!: string;

  @ApiProperty({ minLength: 1, maxLength: 128 })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  deviceRef!: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Set when requesting a challenge to revoke an existing device' })
  @IsOptional()
  @IsUUID()
  deviceId?: string;
}

export class LicenseLifecycleDto {
  @ApiProperty({ enum: ['SUSPEND_LICENSE', 'RESUME_LICENSE', 'REVOKE_LICENSE'] })
  @IsIn(['SUSPEND_LICENSE', 'RESUME_LICENSE', 'REVOKE_LICENSE'])
  command!: 'SUSPEND_LICENSE' | 'RESUME_LICENSE' | 'REVOKE_LICENSE';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class EntitlementDto {
  @ApiProperty()
  token!: string;

  @ApiProperty({ format: 'date-time' })
  expiresAt!: string;

  @ApiProperty({ format: 'uuid' })
  licenseId!: string;

  @ApiProperty({ format: 'uuid' })
  deviceId!: string;

  @ApiProperty()
  entitlementVersion!: number;
}

export class EntitlementVerifyDto {
  @ApiProperty({ description: 'Signed entitlement JWT returned by issue or refresh' })
  @IsString()
  @MinLength(32)
  token!: string;
}

export class EntitlementValidationDto {
  @ApiProperty({ enum: [true] })
  valid!: true;

  @ApiProperty({ format: 'date-time' })
  expiresAt!: string;

  @ApiProperty({ format: 'uuid' })
  licenseId!: string;

  @ApiProperty({ format: 'uuid' })
  deviceId!: string;

  @ApiProperty()
  entitlementVersion!: number;

  @ApiProperty()
  keyVersion!: number;

  @ApiProperty({ additionalProperties: true, type: 'object' })
  rights!: Record<string, unknown>;
}

export class EntitlementRefreshDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  licenseId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  deviceId!: string;

  @ApiProperty({ minLength: 16 })
  @IsString()
  @MinLength(16)
  challenge!: string;

  @ApiProperty({ description: 'EIP-191 device signature over the entitlement challenge' })
  @IsString()
  @Matches(/^0x[0-9a-fA-F]{130}$/)
  proof!: `0x${string}`;
}

export class DeviceChallengeDto {
  @ApiProperty()
  challenge!: string;

  @ApiProperty({ format: 'date-time' })
  expiresAt!: string;
}

export class Phase6CommandDto {
  @ApiProperty({ format: 'uuid' })
  commandId!: string;

  @ApiProperty({ enum: ['PENDING', 'SUBMITTED', 'SUBMITTED_UNKNOWN', 'CONFIRMED', 'RETRYABLE_FAILED', 'DEAD_LETTER'] })
  status!: string;

  @ApiProperty({ format: 'uuid' })
  licenseId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, type: String })
  deviceId!: string | null;
}

export class Phase6CommandStatusDto extends Phase6CommandDto {
  @ApiProperty({ enum: ['ISSUE_LICENSE', 'RENEW_LICENSE', 'SUSPEND_LICENSE', 'RESUME_LICENSE', 'REVOKE_LICENSE', 'ROTATE_KEY', 'ACTIVATE_DEVICE', 'REVOKE_DEVICE'] })
  commandType!: string;

  @ApiPropertyOptional({ format: 'date-time', nullable: true, type: String })
  confirmedAt!: string | null;

  @ApiPropertyOptional({ pattern: '^0x[0-9a-fA-F]{64}$', nullable: true, type: String })
  transactionHash!: string | null;
}
