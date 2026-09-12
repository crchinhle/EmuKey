import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  AI_GATEWAY,
  type AiGatewayPort,
} from './application/ports/ai-gateway.port.js';
import { FakeAiGateway } from './infrastructure/fake-ai.gateway.js';

@Module({
  providers: [
    {
      provide: AI_GATEWAY,
      inject: [ConfigService],
      useFactory: (config: ConfigService): AiGatewayPort => {
        const adapter = config.getOrThrow<string>('AI_ADAPTER');
        if (adapter !== 'fake') {
          throw new Error(`AI adapter ${adapter} is not configured`);
        }
        return new FakeAiGateway();
      },
    },
  ],
  exports: [AI_GATEWAY],
})
export class AssistanceSupportModule {}
