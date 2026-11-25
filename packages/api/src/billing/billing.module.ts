import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { BillingProviderRegistry, BILLING_PROVIDERS } from './billing-provider.registry';
import { BillingService } from './billing.service';
import { FactusProvider } from './providers/factus/factus-provider';
import { BillingLocationConfigurationController } from './billing-location-configuration.controller';
import { BillingLocationConfigurationService } from './billing-location-configuration.service';
import { BillingCredentialEncryptionService } from './billing-credential-encryption.service';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [BillingLocationConfigurationController],
  providers: [
    FactusProvider,
    {
      provide: BILLING_PROVIDERS,
      useFactory: (factusProvider: FactusProvider) => [factusProvider],
      inject: [FactusProvider],
    },
    BillingProviderRegistry,
    BillingLocationConfigurationService,
    BillingCredentialEncryptionService,
    BillingService,
  ],
  exports: [BillingService, BillingProviderRegistry, BillingLocationConfigurationService],
})
export class BillingModule {}
