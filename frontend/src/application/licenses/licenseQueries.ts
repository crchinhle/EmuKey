import { useMutation, useQuery } from '@tanstack/react-query';

import type {
  ActivationKeyDto,
  LicenseProjectionDto,
  PublicLicenseVerificationDto,
} from '../../infrastructure/api/generated';
import { requestJson } from '../auth/authContext';

export function useLicenses() {
  return useQuery({
    queryKey: ['licenses'],
    queryFn: () => requestJson<LicenseProjectionDto[]>('/licenses'),
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
