import { ApiProperty } from '@nestjs/swagger';

export class BlockchainHealthDto {
  @ApiProperty() active_without_finality!: number;
  @ApiProperty() pending_events!: number;
  @ApiProperty() reorged_events!: number;
  @ApiProperty() unknown_commands!: number;
}

export class BlockchainProjectionRepairDto {
  @ApiProperty() commandRepairs!: number;
  @ApiProperty({ isArray: true, type: String }) licenseIds!: string[];
  @ApiProperty() licenseRepairs!: number;
  @ApiProperty() remainingMismatches!: number;
}

export class BlockchainReconciliationDto {
  @ApiProperty({ type: BlockchainHealthDto }) health!: BlockchainHealthDto;
  @ApiProperty() indexedEvents!: number;
  @ApiProperty() processed!: boolean;
  @ApiProperty({ type: BlockchainProjectionRepairDto })
  projection!: BlockchainProjectionRepairDto;
  @ApiProperty({ isArray: true, type: String }) reconciledCommandIds!: string[];
}
