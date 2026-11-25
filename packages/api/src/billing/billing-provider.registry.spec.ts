import { BadRequestException } from '@nestjs/common';
import { BillingProviderRegistry } from './billing-provider.registry';
import { BillingProvider } from './billing.types';

describe('BillingProviderRegistry', () => {
  const factusProvider: BillingProvider = {
    name: 'FACTUS',
    supportedCountries: ['CO'],
    issueInvoice: jest.fn(),
    getInvoiceStatus: jest.fn(),
    findInvoiceByReferenceCode: jest.fn(),
  };

  it('resolves a provider using a normalized country code', () => {
    const registry = new BillingProviderRegistry([factusProvider]);

    expect(registry.forCountry('co')).toBe(factusProvider);
  });

  it('fails explicitly when a country has no registered provider', () => {
    const registry = new BillingProviderRegistry([factusProvider]);

    expect(() => registry.forCountry('US')).toThrow(BadRequestException);
  });
});
