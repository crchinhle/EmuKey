import { fallback, http, type Transport } from 'viem';

const RPC_TIMEOUT_MS = 10_000;

export function createViemRpcTransport(
  primaryUrl: string,
  fallbackUrl?: string,
): Transport {
  const primary = http(primaryUrl, { retryCount: 1, timeout: RPC_TIMEOUT_MS });
  if (!fallbackUrl || fallbackUrl === primaryUrl) return primary;
  return fallback(
    [primary, http(fallbackUrl, { retryCount: 1, timeout: RPC_TIMEOUT_MS })],
    { rank: false, retryCount: 0 },
  );
}
