import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BillingLocationConfiguration, Prisma } from '@prisma/client';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { BillingCredentialEncryptionService } from './billing-credential-encryption.service';
import { BillingLocationConfigurationService } from './billing-location-configuration.service';

describe('BillingLocationConfigurationService', () => {
  let service: BillingLocationConfigurationService;
  let locationFindFirst: jest.Mock;
  let configurationFindUnique: jest.Mock;
  let configurationUpsert: jest.Mock;
  let credentialEncryption: BillingCredentialEncryptionService;

  beforeEach(async () => {
    locationFindFirst = jest.fn(async () => ({ id: 'location-1' }));
    configurationFindUnique = jest.fn(async () => null);
    configurationUpsert = jest.fn(
      async (args: { create: Prisma.BillingLocationConfigurationUncheckedCreateInput }) => ({
        ...makeConfiguration({}),
        ...args.create,
        id: 'billing-config-1',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
    );
    const prismaMock = {
      location: { findFirst: locationFindFirst },
      billingLocationConfiguration: {
        findUnique: configurationFindUnique,
        upsert: configurationUpsert,
      },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        BillingLocationConfigurationService,
        BillingCredentialEncryptionService,
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              key === 'BILLING_CREDENTIALS_ENCRYPTION_KEY'
                ? Buffer.alloc(32, 4).toString('base64')
                : undefined,
          },
        },
      ],
    }).compile();

    service = moduleRef.get(BillingLocationConfigurationService);
    credentialEncryption = moduleRef.get(BillingCredentialEncryptionService);
  });

  it('saves per-location credentials encrypted and never returns their values', async () => {
    const result = await service.updateForLocation('tenant-1', 'location-1', {
      issuerLegalName: 'Restaurant SAS',
      issuerTaxId: '900123456',
      issuerTaxIdDv: '7',
      establishmentName: 'Centro',
      establishmentAddress: 'Calle 1 # 2-3',
      establishmentMunicipalityCode: '11001',
      establishmentPhone: '6015550101',
      establishmentEmail: 'billing@example.test',
      numberingRangeId: 7,
      factusClientId: 'client-id',
      factusClientSecret: 'client-secret',
      factusUsername: 'factus-user',
      factusPassword: 'factus-password',
    });

    const saved = configurationUpsert.mock.calls[0][0].create;
    expect(saved.locationId).toBe('location-1');
    expect(saved.tenantId).toBe('tenant-1');
    expect(saved.factusCredentialsEncrypted).not.toContain('client-secret');
    expect(saved.factusCredentialsEncrypted).not.toContain('factus-password');
    expect(result.credentialsConfigured).toBe(true);
    expect(result.isReady).toBe(true);
    expect(result.missingFields).toEqual([]);
    expect(JSON.stringify(result)).not.toContain('factus-password');
  });

  it('identifies required location settings missing before invoice emission', async () => {
    await expect(service.getForEmission('tenant-1', 'location-1')).rejects.toMatchObject({
      response: {
        code: 'BILLING_CONFIGURATION_INCOMPLETE',
        missingFields: expect.arrayContaining(['issuerLegalName', 'factusCredentials']),
        message: expect.stringContaining('razón social del emisor'),
      },
    });
  });

  it('requires all Factus credentials when replacing them', async () => {
    await expect(
      service.updateForLocation('tenant-1', 'location-1', {
        factusClientId: 'client-id',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(configurationUpsert).not.toHaveBeenCalled();
  });

  it('does not expose a location from another tenant', async () => {
    locationFindFirst.mockResolvedValueOnce(null);

    await expect(service.getForLocation('tenant-1', 'other-location')).rejects.toThrow(
      NotFoundException,
    );
    expect(configurationFindUnique).not.toHaveBeenCalled();
  });

  it('returns the saved credentials only to the internal emission flow', async () => {
    const encrypted = credentialEncryption.encrypt({
      clientId: 'client-id',
      clientSecret: 'client-secret',
      username: 'factus-user',
      password: 'factus-password',
    });
    configurationFindUnique.mockResolvedValueOnce(
      makeConfiguration({
        issuerLegalName: 'Restaurant SAS',
        issuerTaxId: '900123456',
        issuerTaxIdDv: '7',
        establishmentName: 'Centro',
        establishmentAddress: 'Calle 1 # 2-3',
        establishmentMunicipalityCode: '11001',
        establishmentPhone: '6015550101',
        establishmentEmail: 'billing@example.test',
        numberingRangeId: 7,
        factusCredentialsEncrypted: encrypted,
      }),
    );

    const result = await service.getForEmission('tenant-1', 'location-1');

    expect(result.countryCode).toBe('CO');
    expect(result.context.numberingRangeId).toBe(7);
    expect(result.context.credentials.clientSecret).toBe('client-secret');
  });

  it('allows invoice emission when no specific numbering range is configured', async () => {
    const encrypted = credentialEncryption.encrypt({
      clientId: 'client-id',
      clientSecret: 'client-secret',
      username: 'factus-user',
      password: 'factus-password',
    });
    configurationFindUnique.mockResolvedValueOnce(
      makeConfiguration({
        issuerLegalName: 'Restaurant SAS',
        issuerTaxId: '900123456',
        issuerTaxIdDv: '7',
        establishmentName: 'Centro',
        establishmentAddress: 'Calle 1 # 2-3',
        establishmentMunicipalityCode: '11001',
        establishmentPhone: '6015550101',
        establishmentEmail: 'billing@example.test',
        factusCredentialsEncrypted: encrypted,
      }),
    );

    const result = await service.getForEmission('tenant-1', 'location-1');

    expect(result.context.numberingRangeId).toBeUndefined();
  });

  it('loads credentials for a connection test without requiring a complete fiscal profile', async () => {
    const encrypted = credentialEncryption.encrypt({
      clientId: 'client-id',
      clientSecret: 'client-secret',
      username: 'factus-user',
      password: 'factus-password',
    });
    configurationFindUnique.mockResolvedValueOnce(
      makeConfiguration({ factusCredentialsEncrypted: encrypted }),
    );

    const result = await service.getForConnectionTest('tenant-1', 'location-1');

    expect(result.countryCode).toBe('CO');
    expect(result.context.credentials).toEqual({
      clientId: 'client-id',
      clientSecret: 'client-secret',
      username: 'factus-user',
      password: 'factus-password',
    });
    expect(result.context.numberingRangeId).toBeUndefined();
  });
});

function makeConfiguration(
  overrides: Partial<BillingLocationConfiguration>,
): BillingLocationConfiguration {
  return {
    id: 'billing-config-1',
    tenantId: 'tenant-1',
    locationId: 'location-1',
    countryCode: 'CO',
    issuerLegalName: null,
    issuerTaxId: null,
    issuerTaxIdDv: null,
    establishmentName: null,
    establishmentAddress: null,
    establishmentMunicipalityCode: null,
    establishmentPhone: null,
    establishmentEmail: null,
    numberingRangeId: null,
    factusCredentialsEncrypted: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}
