import { Module } from '@nestjs/common';

import { PlatformCoreModule } from './platform/platform-core.module.js';
import { BlockchainModule } from './modules/blockchain/blockchain.module.js';
import { BlockchainWorkerModule } from './modules/blockchain/blockchain-worker.module.js';

const workerImports =
  process.env.NODE_ENV === 'test'
    ? [BlockchainModule]
    : [BlockchainWorkerModule];

@Module({
  imports: [PlatformCoreModule, ...workerImports],
})
export class WorkerModule {}
