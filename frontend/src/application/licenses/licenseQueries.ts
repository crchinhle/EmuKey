import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  ActivateDeviceDto,
  ActivationChallengeDto,
  ActivationKeyDto,
  DeviceChallengeDto,
  LicenseDeviceDto,
  EntitlementDto,
  EntitlementValidationDto,
  LicenseProjectionDto,
  Phase6CommandDto,
  Phase6CommandStatusDto,
  PublicLicenseVerificationDto,
  RevokeDeviceDto,
  RotateActivationKeyDto,
} from '../../infrastructure/api/generated';
import { requestJson } from '../auth/authContext';

export function useLicenses() {
  return useQuery({
    queryKey: ['licenses'],
    queryFn: () => requestJson<LicenseProjectionDto[]>('/licenses'),
  });
}

export function useProviderLicenses() {
  return useQuery({
    queryKey: ['licenses', 'provider'],
    queryFn: () => requestJson<LicenseProjectionDto[]>('/licenses'),
  });
}

export function useLicenseLifecycle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ licenseId, command, reason }: { licenseId: string; command: 'SUSPEND_LICENSE' | 'RESUME_LICENSE' | 'REVOKE_LICENSE'; reason?: string }) =>
      requestJson<Phase6CommandDto>(`/licenses/${encodeURIComponent(licenseId)}/lifecycle`, {
        body: JSON.stringify({ command, ...(reason ? { reason } : {}) }),
        method: 'POST',
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['licenses', 'provider'] }),
  });
}

export function useRequestLicensingActionVerification() {
  return useMutation({
    mutationFn: ({ licenseId, action }: { licenseId: string; action: 'ROTATE_KEY' | 'REVOKE_DEVICE' }) =>
      requestJson<{ accepted: boolean }>('/licenses/action-verification', {
        body: JSON.stringify({ action, licenseId }),
        method: 'POST',
      }),
  });
}

export function usePhase6Command(commandId: string | undefined) {
  return useQuery({
    enabled: Boolean(commandId),
    queryKey: ['phase6-command', commandId],
    queryFn: () => requestJson<Phase6CommandStatusDto>(`/commands/${encodeURIComponent(commandId!)}`),
    refetchInterval: (query) => ['CONFIRMED', 'DEAD_LETTER'].includes(query.state.data?.status ?? '') ? false : 2_000,
  });
}

export function useRetrieveActivationKey() {
  return useMutation({
    mutationFn: ({ id }: { id: string }) =>
      requestJson<ActivationKeyDto>(
        `/licenses/${encodeURIComponent(id)}/activation-key/retrieve`,
        { method: 'POST' },
      ),
  });
}

export function usePublicLicenseVerification() {
  return useMutation({
    mutationFn: (publicId: string) =>
      requestJson<PublicLicenseVerificationDto>(
        `/public/licenses/${encodeURIComponent(publicId)}/verify`,
      ),
  });
}

export function useActivationChallenge() {
  return useMutation({
    mutationFn: (input: ActivationChallengeDto) =>
      requestJson<DeviceChallengeDto>('/activations/challenge', {
        body: JSON.stringify(input),
        method: 'POST',
      }),
  });
}

export function useLicenseDevices(licenseId: string | undefined) {
  return useQuery({
    enabled: Boolean(licenseId),
    queryKey: ['licenses', licenseId, 'devices'],
    queryFn: () => requestJson<LicenseDeviceDto[]>(`/licenses/${encodeURIComponent(licenseId!)}/devices`),
  });
}

export function useActivateDevice() {
  return useMutation({
    mutationFn: (input: ActivateDeviceDto) =>
      requestJson<Phase6CommandDto>('/activations', {
        body: JSON.stringify(input),
        method: 'POST',
      }),
  });
}

export function useRevokeDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ licenseId, deviceId, input }: { licenseId: string; deviceId: string; input: RevokeDeviceDto }) =>
      requestJson<Phase6CommandDto>(
        `/licenses/${encodeURIComponent(licenseId)}/devices/${encodeURIComponent(deviceId)}/revoke`,
        { body: JSON.stringify(input), method: 'POST' },
      ),
    onSuccess: (_value, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['licenses', variables.licenseId, 'devices'] });
    },
  });
}

export function useRotateActivationKey() {
  return useMutation({
    mutationFn: ({ licenseId, input }: { licenseId: string; input: RotateActivationKeyDto }) =>
      requestJson<Phase6CommandDto>(
        `/licenses/${encodeURIComponent(licenseId)}/activation-key/rotate`,
        { body: JSON.stringify(input), method: 'POST' },
      ),
  });
}

export function useIssueEntitlement() {
  return useMutation({
    mutationFn: ({ licenseId, deviceId, challenge, proof }: { licenseId: string; deviceId: string; challenge: string; proof: string }) =>
      requestJson<EntitlementDto>('/entitlements/issue', {
        body: JSON.stringify({ challenge, deviceId, licenseId, proof }),
        method: 'POST',
      }),
  });
}

export function useRefreshEntitlement() {
  return useMutation({
    mutationFn: ({ licenseId, deviceId, challenge, proof }: { licenseId: string; deviceId: string; challenge: string; proof: string }) =>
      requestJson<EntitlementDto>('/entitlements/refresh', {
        body: JSON.stringify({ challenge, deviceId, licenseId, proof }),
        method: 'POST',
      }),
  });
}

export function useVerifyEntitlement() {
  return useMutation({
    mutationFn: (token: string) =>
      requestJson<EntitlementValidationDto>('/entitlements/verify', {
        body: JSON.stringify({ token }),
        method: 'POST',
      }),
  });
}
