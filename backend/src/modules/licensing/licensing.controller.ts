import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  Get,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser, Roles } from '../identity-access/security.decorators.js';
import { AuthGuard, RolesGuard } from '../identity-access/security.guards.js';
import type { AuthPrincipal } from '../identity-access/identity.types.js';
import {
  ActivateDeviceDto,
  ActivationChallengeDto,
  DeviceChallengeDto,
  EntitlementDto,
  EntitlementRefreshDto,
  EntitlementValidationDto,
  EntitlementVerifyDto,
  LicenseLifecycleDto,
  Phase6CommandDto,
  Phase6CommandStatusDto,
  RevokeDeviceDto,
  RemoteRevokeDeviceDto,
  ActivationKeyRecoveryDto,
  RotateActivationKeyDto,
  LicensingActionVerificationDto,
} from './licensing.dto.js';
import { LicensingService } from './licensing.service.js';

@ApiTags('licensing')
@Controller()
@UseGuards(AuthGuard, RolesGuard)
@ApiBearerAuth()
export class LicensingController {
  constructor(private readonly service: LicensingService) {}

  @Post('activations/challenge')
  @Roles('CUSTOMER')
  @ApiCreatedResponse({ type: DeviceChallengeDto })
  challenge(@CurrentUser() actor: AuthPrincipal, @Body() dto: ActivationChallengeDto) {
    return this.service.challenge(actor, dto);
  }

  @Post('activations')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Request a device activation command after off-chain proof verification' })
  @ApiCreatedResponse({ type: Phase6CommandDto })
  activate(@CurrentUser() actor: AuthPrincipal, @Body() dto: ActivateDeviceDto) {
    return this.service.activate(actor, dto);
  }

  @Post('licenses/action-verification')
  @Roles('CUSTOMER')
  requestActionVerification(@CurrentUser() actor: AuthPrincipal, @Body() dto: LicensingActionVerificationDto) {
    return this.service.requestActionVerification(actor, dto);
  }

  @Get('commands/:commandId')
  @Roles('CUSTOMER', 'PROVIDER_ADMIN')
  @ApiOkResponse({ type: Phase6CommandStatusDto })
  commandStatus(@CurrentUser() actor: AuthPrincipal, @Param('commandId', ParseUUIDPipe) commandId: string) {
    return this.service.commandStatus(actor, commandId);
  }

  @Post('licenses/:licenseId/devices/:deviceId/revoke')
  @Roles('CUSTOMER')
  @ApiCreatedResponse({ type: Phase6CommandDto })
  revokeDevice(
    @CurrentUser() actor: AuthPrincipal,
    @Param('licenseId', ParseUUIDPipe) licenseId: string,
    @Param('deviceId', ParseUUIDPipe) deviceId: string,
    @Body() dto: RevokeDeviceDto,
  ) {
    return this.service.revokeDevice(actor, licenseId, deviceId, dto);
  }

  @Post('licenses/:licenseId/devices/:deviceId/remote-revoke')
  @Roles('CUSTOMER')
  @ApiCreatedResponse({ type: Phase6CommandDto })
  remoteRevokeDevice(
    @CurrentUser() actor: AuthPrincipal,
    @Param('licenseId', ParseUUIDPipe) licenseId: string,
    @Param('deviceId', ParseUUIDPipe) deviceId: string,
    @Body() dto: RemoteRevokeDeviceDto,
  ) {
    return this.service.remoteRevokeDevice(actor, licenseId, deviceId, dto);
  }

  @Post('licenses/:licenseId/activation-key/rotate')
  @Roles('CUSTOMER')
  @ApiCreatedResponse({ type: Phase6CommandDto })
  rotate(
    @CurrentUser() actor: AuthPrincipal,
    @Param('licenseId', ParseUUIDPipe) licenseId: string,
    @Body() dto: RotateActivationKeyDto,
  ) {
    return this.service.rotate(actor, licenseId, dto);
  }

  @Post('licenses/:licenseId/activation-key/recover')
  @Roles('CUSTOMER')
  @ApiCreatedResponse({ type: Phase6CommandDto })
  recoverActivationKey(
    @CurrentUser() actor: AuthPrincipal,
    @Param('licenseId', ParseUUIDPipe) licenseId: string,
    @Body() dto: ActivationKeyRecoveryDto,
  ) {
    return this.service.recoverActivationKey(actor, licenseId, dto);
  }

  @Post('licenses/:licenseId/lifecycle')
  @Roles('PROVIDER_ADMIN')
  @ApiCreatedResponse({ type: Phase6CommandDto })
  lifecycle(
    @CurrentUser() actor: AuthPrincipal,
    @Param('licenseId', ParseUUIDPipe) licenseId: string,
    @Body() dto: LicenseLifecycleDto,
  ) {
    return this.service.lifecycle(actor, licenseId, dto);
  }

  @Post('entitlements/issue')
  @Roles('CUSTOMER')
  @ApiCreatedResponse({ type: EntitlementDto })
  issueEntitlement(@CurrentUser() actor: AuthPrincipal, @Body() dto: EntitlementRefreshDto) {
    return this.service.issueEntitlement(actor, dto);
  }

  @Post('entitlements/refresh')
  @Roles('CUSTOMER')
  @ApiCreatedResponse({ type: EntitlementDto })
  refreshEntitlement(@CurrentUser() actor: AuthPrincipal, @Body() dto: EntitlementRefreshDto) {
    return this.service.refreshEntitlement(actor, dto);
  }

  @Post('entitlements/verify')
  @Roles('CUSTOMER')
  @ApiOkResponse({ type: EntitlementValidationDto })
  verifyEntitlement(@CurrentUser() actor: AuthPrincipal, @Body() dto: EntitlementVerifyDto) {
    return this.service.verifyEntitlement(actor, dto);
  }
}
