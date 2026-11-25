import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { BillingProviderRegistry, BILLING_PROVIDERS } from './billing-provider.registry';
import { BillingService } from './billing.service';
import { FactusProvider } from './providers/factus/factus-provider';
import { BillingLocationConfigurationController } from './billing-location-configuration.controller';
import { BillingLocationConfigurationService } from './billing-location-configuration.service';
import { BillingCredentialEncryptionService } from './billing-credential-encryption.service';
import { PosBillingController } from './pos-billing.controller';
import { PosBillingService } from './pos-billing.service';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [BillingLocationConfigurationController, PosBillingController],
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
    PosBillingService,
  ],
  exports: [BillingService, BillingProviderRegistry, BillingLocationConfigurationService],
})
export class BillingModule {}
