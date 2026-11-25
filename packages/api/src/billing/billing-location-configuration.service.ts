import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BillingLocationConfiguration } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  BillingCredentialEncryptionService,
  FactusCredentials,
} from './billing-credential-encryption.service';
import { UpdateBillingLocationConfigurationDto } from './dto/update-billing-location-configuration.dto';
import { BillingProviderContext } from './billing.types';

export interface BillingLocationConfigurationView {
  locationId: string;
  countryCode: string;
  issuerLegalName: string | null;
  issuerTaxId: string | null;
  issuerTaxIdDv: string | null;
  establishmentName: string | null;
  establishmentAddress: string | null;
  establishmentMunicipalityCode: string | null;
  establishmentPhone: string | null;
  establishmentEmail: string | null;
  numberingRangeId: number | null;
  credentialsConfigured: boolean;
  isReady: boolean;
}

export interface BillingConfigurationForEmission {
  countryCode: string;
  context: BillingProviderContext;
}

type ReadyBillingLocationConfiguration = BillingLocationConfiguration & {
  numberingRangeId: number;
  factusCredentialsEncrypted: string;
};

@Injectable()
export class BillingLocationConfigurationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credentialEncryption: BillingCredentialEncryptionService,
  ) {}

  async getForLocation(
    tenantId: string,
    locationId: string,
  ): Promise<BillingLocationConfigurationView> {
    await this.assertLocationBelongsToTenant(tenantId, locationId);
    const configuration = await this.prisma.billingLocationConfiguration.findUnique({
      where: { tenantId_locationId: { tenantId, locationId } },
    });
    return configuration ? toView(configuration) : emptyConfiguration(locationId);
  }

  async updateForLocation(
    tenantId: string,
    locationId: string,
    input: UpdateBillingLocationConfigurationDto,
  ): Promise<BillingLocationConfigurationView> {
    await this.assertLocationBelongsToTenant(tenantId, locationId);
    const existing = await this.prisma.billingLocationConfiguration.findUnique({
      where: { tenantId_locationId: { tenantId, locationId } },
    });
    const credentials = readCredentials(input);
    const hasCredentials = Object.values(credentials).some(
      (value) => value !== undefined && value.length > 0,
    );
    const completeCredentials = toCompleteCredentials(credentials);
    let encryptedCredentials = existing?.factusCredentialsEncrypted ?? null;

    if (hasCredentials) {
      if (!completeCredentials) {
        throw new BadRequestException(
          'Provide all four Factus credentials together, or leave all four blank to keep the saved credentials.',
        );
      }
      encryptedCredentials = this.credentialEncryption.encrypt(completeCredentials);
    }

    const data = {
      countryCode: 'CO',
      issuerLegalName: normalizeOptional(input.issuerLegalName),
      issuerTaxId: normalizeOptional(input.issuerTaxId),
      issuerTaxIdDv: normalizeOptional(input.issuerTaxIdDv),
      establishmentName: normalizeOptional(input.establishmentName),
      establishmentAddress: normalizeOptional(input.establishmentAddress),
      establishmentMunicipalityCode: normalizeOptional(input.establishmentMunicipalityCode),
      establishmentPhone: normalizeOptional(input.establishmentPhone),
      establishmentEmail: normalizeOptional(input.establishmentEmail),
      numberingRangeId: input.numberingRangeId ?? null,
      factusCredentialsEncrypted: encryptedCredentials,
    };

    const configuration = await this.prisma.billingLocationConfiguration.upsert({
      where: { tenantId_locationId: { tenantId, locationId } },
      create: {
        tenantId,
        locationId,
        ...data,
      },
      update: data,
    });
    return toView(configuration);
  }

  async getForEmission(
    tenantId: string,
    locationId: string,
  ): Promise<BillingConfigurationForEmission> {
    await this.assertLocationBelongsToTenant(tenantId, locationId);
    const configuration = await this.prisma.billingLocationConfiguration.findUnique({
      where: { tenantId_locationId: { tenantId, locationId } },
    });
    if (!configuration || !isReady(configuration)) {
      throw new BadRequestException(
        'Electronic billing is not fully configured for this location.',
      );
    }

    const credentials = this.credentialEncryption.decrypt(configuration.factusCredentialsEncrypted);
    return {
      countryCode: configuration.countryCode,
      context: {
        credentials,
        numberingRangeId: configuration.numberingRangeId,
      },
    };
  }

  private async assertLocationBelongsToTenant(tenantId: string, locationId: string): Promise<void> {
    const location = await this.prisma.location.findFirst({
      where: { id: locationId, tenantId },
      select: { id: true },
    });
    if (!location) {
      throw new NotFoundException('Location not found for this tenant.');
    }
  }
}

function readCredentials(input: UpdateBillingLocationConfigurationDto): Partial<FactusCredentials> {
  return {
    ...(input.factusClientId !== undefined ? { clientId: input.factusClientId.trim() } : {}),
    ...(input.factusClientSecret !== undefined ? { clientSecret: input.factusClientSecret } : {}),
    ...(input.factusUsername !== undefined ? { username: input.factusUsername.trim() } : {}),
    ...(input.factusPassword !== undefined ? { password: input.factusPassword } : {}),
  };
}

function toCompleteCredentials(credentials: Partial<FactusCredentials>): FactusCredentials | null {
  const { clientId, clientSecret, username, password } = credentials;
  if (!clientId || !clientSecret || !username || !password) {
    return null;
  }
  return { clientId, clientSecret, username, password };
}

function normalizeOptional(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized || null;
}

function isReady(
  configuration: BillingLocationConfiguration,
): configuration is ReadyBillingLocationConfiguration {
  return Boolean(
    configuration.issuerLegalName &&
      configuration.issuerTaxId &&
      configuration.issuerTaxIdDv &&
      configuration.establishmentName &&
      configuration.establishmentAddress &&
      configuration.establishmentMunicipalityCode &&
      configuration.establishmentPhone &&
      configuration.establishmentEmail &&
      configuration.numberingRangeId &&
      configuration.factusCredentialsEncrypted,
  );
}

function toView(configuration: BillingLocationConfiguration): BillingLocationConfigurationView {
  return {
    locationId: configuration.locationId,
    countryCode: configuration.countryCode,
    issuerLegalName: configuration.issuerLegalName,
    issuerTaxId: configuration.issuerTaxId,
    issuerTaxIdDv: configuration.issuerTaxIdDv,
    establishmentName: configuration.establishmentName,
    establishmentAddress: configuration.establishmentAddress,
    establishmentMunicipalityCode: configuration.establishmentMunicipalityCode,
    establishmentPhone: configuration.establishmentPhone,
    establishmentEmail: configuration.establishmentEmail,
    numberingRangeId: configuration.numberingRangeId,
    credentialsConfigured: Boolean(configuration.factusCredentialsEncrypted),
    isReady: isReady(configuration),
  };
}

function emptyConfiguration(locationId: string): BillingLocationConfigurationView {
  return {
    locationId,
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
    credentialsConfigured: false,
    isReady: false,
  };
}
