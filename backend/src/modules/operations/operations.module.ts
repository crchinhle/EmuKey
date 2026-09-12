import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  EMAIL_DELIVERY,
  type EmailDeliveryPort,
} from './application/ports/email-delivery.port.js';
import {
  PUSH_DELIVERY,
  type PushDeliveryPort,
} from './application/ports/push-delivery.port.js';
import { FakeEmailDelivery } from './infrastructure/fake-email-delivery.js';
import { FakePushDelivery } from './infrastructure/fake-push-delivery.js';

@Module({
  providers: [
    {
      provide: EMAIL_DELIVERY,
      inject: [ConfigService],
      useFactory: (config: ConfigService): EmailDeliveryPort => {
        const adapter = config.getOrThrow<string>('EMAIL_ADAPTER');
        if (adapter !== 'fake') {
          throw new Error(`Email adapter ${adapter} is not configured`);
        }
        return new FakeEmailDelivery();
      },
    },
    {
      provide: PUSH_DELIVERY,
      inject: [ConfigService],
      useFactory: (config: ConfigService): PushDeliveryPort => {
        const adapter = config.getOrThrow<string>('PUSH_ADAPTER');
        if (adapter !== 'fake') {
          throw new Error(`Push adapter ${adapter} is not configured`);
        }
        return new FakePushDelivery();
      },
    },
  ],
  exports: [EMAIL_DELIVERY, PUSH_DELIVERY],
})
export class OperationsModule {}
