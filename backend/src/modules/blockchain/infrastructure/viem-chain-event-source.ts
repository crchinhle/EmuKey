import {
  createPublicClient,
  defineChain,
  getAddress,
  http,
  type Address,
  type Hex,
} from 'viem';

import { licenseRegistryAbi } from './license-registry-contract.js';

const INDEXED_EVENT_NAMES = new Set([
  'ActivationKeyRotated',
  'DeviceStatusChanged',
  'LicenseIssued',
  'LicenseRenewed',
  'LicenseStatusChanged',
]);

export interface RpcContractEvent {
  args: Record<string, unknown>;
  blockHash: Hex;
  blockNumber: bigint;
  eventName: string;
  logIndex: number;
  transactionHash: Hex;
}

export interface ChainEventRpcPort {
  blockHash(blockNumber: number): Promise<Hex>;
  contractEvents(
    fromBlock: number,
    toBlock: number,
  ): Promise<RpcContractEvent[]>;
  latestBlock(): Promise<number>;
}

export interface ViemChainEventSourceOptions {
  chainId: number;
  contractAddress: Address;
  network: string;
  rpcUrl: string;
}

export class ViemChainEventSource implements ChainEventRpcPort {
  private readonly client;

  constructor(private readonly options: ViemChainEventSourceOptions) {
    const chain = defineChain({
      id: options.chainId,
      name: options.network,
      nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
      rpcUrls: { default: { http: [options.rpcUrl] } },
      testnet: options.network !== 'mainnet',
    });
    this.client = createPublicClient({
      chain,
      transport: http(options.rpcUrl),
    });
  }

  async latestBlock(): Promise<number> {
    return Number(await this.client.getBlockNumber());
  }

  async blockHash(blockNumber: number): Promise<Hex> {
    const block = await this.client.getBlock({
      blockNumber: BigInt(blockNumber),
    });
    if (!block.hash) throw new Error('CHAIN_BLOCK_HASH_UNAVAILABLE');
    return block.hash;
  }

  async contractEvents(
    fromBlock: number,
    toBlock: number,
  ): Promise<RpcContractEvent[]> {
    const logs = await this.client.getContractEvents({
      abi: licenseRegistryAbi,
      address: getAddress(this.options.contractAddress),
      fromBlock: BigInt(fromBlock),
      strict: true,
      toBlock: BigInt(toBlock),
    });
    return logs
      .filter(
        (log) =>
          'eventName' in log && INDEXED_EVENT_NAMES.has(String(log.eventName)),
      )
      .map((log) => {
        if (
          !log.blockHash ||
          log.blockNumber === null ||
          log.logIndex === null ||
          !log.transactionHash ||
          !('eventName' in log) ||
          !('args' in log)
        ) {
          throw new Error('CHAIN_EVENT_INCOMPLETE');
        }
        return {
          args: log.args as Record<string, unknown>,
          blockHash: log.blockHash,
          blockNumber: log.blockNumber,
          eventName: String(log.eventName),
          logIndex: log.logIndex,
          transactionHash: log.transactionHash,
        };
      });
  }
}
