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
  missingFields: BillingLocationMissingField[];
}

export type BillingLocationMissingField =
  | 'issuerLegalName'
  | 'issuerTaxId'
  | 'issuerTaxIdDv'
  | 'establishmentName'
  | 'establishmentAddress'
  | 'establishmentMunicipalityCode'
  | 'establishmentPhone'
  | 'establishmentEmail'
  | 'factusCredentials';

export interface BillingConfigurationForEmission {
  countryCode: string;
  context: BillingProviderContext;
}

const REQUIRED_CONFIGURATION_FIELDS: BillingLocationMissingField[] = [
  'issuerLegalName',
  'issuerTaxId',
  'issuerTaxIdDv',
  'establishmentName',
  'establishmentAddress',
  'establishmentMunicipalityCode',
  'establishmentPhone',
  'establishmentEmail',
  'factusCredentials',
];

const MISSING_FIELD_LABELS: Record<BillingLocationMissingField, string> = {
  issuerLegalName: 'razón social del emisor',
  issuerTaxId: 'NIT del emisor',
  issuerTaxIdDv: 'dígito de verificación del emisor',
  establishmentName: 'nombre del establecimiento',
  establishmentAddress: 'dirección del establecimiento',
  establishmentMunicipalityCode: 'código DANE del municipio',
  establishmentPhone: 'teléfono del establecimiento',
  establishmentEmail: 'correo del establecimiento',
  factusCredentials: 'credenciales Factus (Client ID, Client secret, usuario y contraseña)',
};

type ReadyBillingLocationConfiguration = BillingLocationConfiguration & {
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
      const missingFields = configuration
        ? getMissingConfigurationFields(configuration)
        : REQUIRED_CONFIGURATION_FIELDS;
      const missingLabels = missingFields.map((field) => MISSING_FIELD_LABELS[field]);
      throw new BadRequestException({
        code: 'BILLING_CONFIGURATION_INCOMPLETE',
        message: `Completa la configuración de facturación de esta ubicación. Faltan: ${missingLabels.join(', ')}.`,
        missingFields,
      });
    }

    const credentials = this.credentialEncryption.decrypt(configuration.factusCredentialsEncrypted);
    return {
      countryCode: configuration.countryCode,
      context: {
        credentials,
        ...(configuration.numberingRangeId !== null
          ? { numberingRangeId: configuration.numberingRangeId }
          : {}),
      },
    };
  }

  async getForConnectionTest(
    tenantId: string,
    locationId: string,
  ): Promise<BillingConfigurationForEmission> {
    await this.assertLocationBelongsToTenant(tenantId, locationId);
    const configuration = await this.prisma.billingLocationConfiguration.findUnique({
      where: { tenantId_locationId: { tenantId, locationId } },
    });
    if (!configuration?.factusCredentialsEncrypted) {
      throw new BadRequestException('Factus credentials are not configured for this location.');
    }

    return {
      countryCode: configuration.countryCode,
      context: {
        credentials: this.credentialEncryption.decrypt(configuration.factusCredentialsEncrypted),
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
  return getMissingConfigurationFields(configuration).length === 0;
}

function getMissingConfigurationFields(
  configuration: BillingLocationConfiguration,
): BillingLocationMissingField[] {
  return REQUIRED_CONFIGURATION_FIELDS.filter((field) => {
    if (field === 'factusCredentials') return !configuration.factusCredentialsEncrypted;
    return !configuration[field];
  });
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
    missingFields: getMissingConfigurationFields(configuration),
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
    missingFields: [...REQUIRED_CONFIGURATION_FIELDS],
  };
}
