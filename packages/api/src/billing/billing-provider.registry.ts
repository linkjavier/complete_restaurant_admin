import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { BillingProvider } from './billing.types';

export const BILLING_PROVIDERS = 'BILLING_PROVIDERS';

@Injectable()
export class BillingProviderRegistry {
  constructor(
    @Inject(BILLING_PROVIDERS)
    private readonly providers: BillingProvider[],
  ) {}

  forCountry(countryCode: string): BillingProvider {
    const normalizedCountryCode = countryCode.trim().toUpperCase();
    const provider = this.providers.find((candidate) =>
      candidate.supportedCountries.includes(normalizedCountryCode),
    );

    if (!provider) {
      throw new BadRequestException(
        `No billing provider is configured for country ${normalizedCountryCode || '(empty)'}`,
      );
    }

    return provider;
  }
}
