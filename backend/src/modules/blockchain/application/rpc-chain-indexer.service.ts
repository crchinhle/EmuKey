import type {
  ChainCommandEventContext,
  ChainIndexerCheckpointRepository,
  CheckpointOwner,
} from '../infrastructure/chain-indexer-checkpoint.repository.js';
import type {
  ChainEventRpcPort,
  RpcContractEvent,
} from '../infrastructure/viem-chain-event-source.js';
import type { ChainIndexerService } from './chain-indexer.service.js';
import type { ChainEventType } from '../infrastructure/chain-event.repository.js';

export const CHAIN_RPC_INDEXER = Symbol('CHAIN_RPC_INDEXER');

export interface ChainRpcIndexerPort {
  poll(workerId: string): Promise<number | null>;
}

export interface RpcChainIndexerOptions extends CheckpointOwner {
  batchSize: number;
  deploymentBlock: number;
  requiredConfirmations: number;
}

function bytes16ToUuid(value: unknown, name: string): string {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{32}$/.test(value)) {
    throw new Error(`CHAIN_EVENT_${name.toUpperCase()}_INVALID`);
  }
  const hex = value.slice(2).toLowerCase();
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function eventType(log: RpcContractEvent): ChainEventType {
  switch (log.eventName) {
    case 'LicenseIssued':
      return 'LICENSE_ISSUED';
    case 'LicenseRenewed':
      return 'LICENSE_RENEWED';
    case 'ActivationKeyRotated':
      return 'KEY_ROTATED';
    case 'DeviceStatusChanged':
      return log.args.active === true ? 'DEVICE_ACTIVATED' : 'DEVICE_REVOKED';
    case 'LicenseStatusChanged': {
      const status = Number(log.args.status);
      if (status === 1) return 'LICENSE_RESUMED';
      if (status === 2) return 'LICENSE_SUSPENDED';
      if (status === 3) return 'LICENSE_REVOKED';
      throw new Error('CHAIN_EVENT_LICENSE_STATUS_UNSUPPORTED');
    }
    default:
      throw new Error(`CHAIN_EVENT_${log.eventName}_UNSUPPORTED`);
  }
}

function eventPayload(log: RpcContractEvent): Record<string, unknown> {
  if (log.eventName === 'LicenseRenewed') {
    return {
      expiresAt: new Date(Number(log.args.expiresAt) * 1_000).toISOString(),
    };
  }
  if (log.eventName === 'ActivationKeyRotated') {
    return {
      activationCommitment: log.args.activationCommitment,
      keyVersion: Number(log.args.activationKeyVersion),
    };
  }
  if (log.eventName === 'DeviceStatusChanged') {
    return { active: log.args.active, deviceId: log.args.deviceId };
  }
  return {};
}

function identity(transactionHash: string, logIndex: number): string {
  return `${transactionHash.toLowerCase()}:${logIndex}`;
}

export class RpcChainIndexerService implements ChainRpcIndexerPort {
  constructor(
    private readonly checkpoints: Pick<
      ChainIndexerCheckpointRepository,
      | 'claimRange'
      | 'commandContext'
      | 'completeRange'
      | 'eventIdentities'
      | 'release'
    >,
    private readonly indexer: Pick<
      ChainIndexerService,
      'ingest' | 'markReorged'
    >,
    private readonly rpc: ChainEventRpcPort,
    private readonly options: RpcChainIndexerOptions,
  ) {}

  async poll(workerId: string): Promise<number | null> {
    const latestBlock = await this.rpc.latestBlock();
    if (latestBlock < this.options.deploymentBlock) return null;
    const range = await this.checkpoints.claimRange(
      this.options,
      workerId,
      this.options.deploymentBlock,
      latestBlock,
      this.options.batchSize,
      this.options.requiredConfirmations + 1,
    );
    if (!range) return null;
    try {
      const [logs, existing] = await Promise.all([
        this.rpc.contractEvents(range.fromBlock, range.toBlock),
        this.checkpoints.eventIdentities(
          this.options,
          range.fromBlock,
          range.toBlock,
        ),
      ]);
      const canonical = new Map(
        logs.map((log) => [
          identity(log.transactionHash, log.logIndex),
          log.blockHash.toLowerCase(),
        ]),
      );
      for (const stored of existing) {
        if (
          canonical.get(identity(stored.transactionHash, stored.logIndex)) !==
          stored.blockHash.toLowerCase()
        ) {
          await this.indexer.markReorged(stored.id);
        }
      }
      for (const log of logs) await this.ingest(log, latestBlock);
      await this.checkpoints.completeRange(
        this.options,
        workerId,
        range,
        await this.rpc.blockHash(range.toBlock),
      );
      return logs.length;
    } catch (error) {
      await this.checkpoints.release(this.options, workerId);
      throw error;
    }
  }

  private async ingest(
    log: RpcContractEvent,
    latestBlock: number,
  ): Promise<void> {
    const commandId = bytes16ToUuid(log.args.commandId, 'commandId');
    const licenseId = bytes16ToUuid(log.args.licenseId, 'licenseId');
    const context = await this.checkpoints.commandContext(commandId);
    this.assertContext(context, licenseId);
    await this.indexer.ingest({
      blockHash: log.blockHash,
      blockNumber: Number(log.blockNumber),
      chainCommandId: context.commandId,
      chainId: this.options.chainId,
      confirmationCount: latestBlock - Number(log.blockNumber) + 1,
      contractAddress: this.options.contractAddress,
      eventType: eventType(log),
      ...(context.licenseDeviceId
        ? { licenseDeviceId: context.licenseDeviceId }
        : {}),
      licenseId,
      logIndex: log.logIndex,
      network: this.options.network,
      payload: eventPayload(log),
      providerUserId: context.providerUserId,
      transactionHash: log.transactionHash,
    });
  }

  private assertContext(
    context: ChainCommandEventContext | null,
    licenseId: string,
  ): asserts context is ChainCommandEventContext {
    if (!context || context.licenseId !== licenseId) {
      throw new Error('CHAIN_EVENT_COMMAND_CONTEXT_MISMATCH');
    }
  }
}
