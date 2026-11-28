import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BillingDocument,
  BillingDocumentStatus,
  BillingDocumentType,
  Prisma,
} from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { BillingEmissionError, BillingProviderError } from './billing.errors';
import { BillingProviderRegistry } from './billing-provider.registry';
import { BillingLocationConfigurationService } from './billing-location-configuration.service';
import { parseBillingInvoiceInput } from './billing.validation';
import {
  BillingProvider,
  BillingProviderContext,
  BillingProviderResult,
  EmitInvoiceCommand,
} from './billing.types';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: BillingProviderRegistry,
    private readonly configService: ConfigService,
    private readonly locationConfigurations: BillingLocationConfigurationService,
  ) {}

  async issueInvoice(command: EmitInvoiceCommand): Promise<BillingDocument> {
    return this.issueInvoiceInternal(command, false);
  }

  async retryInvoice(command: EmitInvoiceCommand): Promise<BillingDocument> {
    return this.issueInvoiceInternal(command, true);
  }

  async retryStoredInvoice(tenantId: string, billingDocumentId: string): Promise<BillingDocument> {
    const document = await this.prisma.billingDocument.findFirst({
      where: { id: billingDocumentId, tenantId },
      include: {
        orderLinks: { select: { orderId: true } },
        payments: { select: { id: true } },
      },
    });
    if (!document) {
      throw new NotFoundException('Billing document not found for this tenant.');
    }
    if (!document.requestPayload) {
      throw new BadRequestException('This billing document has no stored request to retry.');
    }

    return this.retryInvoice({
      tenantId,
      locationId: document.locationId,
      idempotencyKey: document.idempotencyKey,
      orderId: document.orderId ?? undefined,
      orderIds: document.orderLinks.map(({ orderId }) => orderId),
      paymentIds: document.payments?.map(({ id }) => id) ?? [],
      invoice: parseBillingInvoiceInput(document.requestPayload),
    });
  }

  async testConnection(tenantId: string, locationId: string): Promise<{ connected: true }> {
    const billingConfiguration = await this.locationConfigurations.getForConnectionTest(
      tenantId,
      locationId,
    );
    const provider = this.providers.forCountry(
      billingConfiguration.countryCode.trim().toUpperCase(),
    );
    this.assertSandboxEnabled(provider);
    try {
      await provider.testConnection(billingConfiguration.context);
      this.logger.log(
        `Billing provider connection test succeeded: provider=${provider.name}; location=${locationId}`,
      );
    } catch (error) {
      if (error instanceof BillingProviderError) {
        this.logger.warn(
          `Billing provider connection test failed: ${error.code}; location=${locationId}`,
        );
        throw new BadGatewayException({ code: error.code, message: error.message });
      }
      throw error;
    }
    return { connected: true };
  }

  private async issueInvoiceInternal(
    command: EmitInvoiceCommand,
    retryFailed: boolean,
  ): Promise<BillingDocument> {
    const tenantId = command.tenantId.trim();
    const locationId = command.locationId.trim();
    const idempotencyKey = command.idempotencyKey.trim();

    if (!tenantId || !locationId || !idempotencyKey) {
      throw new BadRequestException('Tenant, location, and idempotency key are required.');
    }
    if (idempotencyKey.length > 128) {
      throw new BadRequestException('Idempotency key exceeds 128 characters.');
    }
    const inputInvoice = parseBillingInvoiceInput(command.invoice);
    const billingConfiguration = await this.locationConfigurations.getForEmission(
      tenantId,
      locationId,
    );
    const countryCode = billingConfiguration.countryCode.trim().toUpperCase();
    const context = billingConfiguration.context;
    const invoice = {
      ...inputInvoice,
      numberingRangeId: context.numberingRangeId,
    };
    const orderIds = normalizeOrderIds(command);
    const paymentIds = normalizePaymentIds(command);
    const primaryOrderId = command.orderId ?? orderIds[0];

    const provider = this.providers.forCountry(countryCode);
    this.assertSandboxEnabled(provider);

    const requestHash = hashPayload({
      countryCode,
      providerName: provider.name,
      orderId: primaryOrderId ?? null,
      orderIds,
      ...(paymentIds.length > 0 ? { paymentIds } : {}),
      locationId,
      invoice,
    });
    const referenceCode = createReferenceCode(tenantId, locationId, idempotencyKey);
    const existing = await this.prisma.billingDocument.findUnique({
      where: {
        tenantId_locationId_idempotencyKey: { tenantId, locationId, idempotencyKey },
      },
    });
    if (existing) {
      const matchingDocument = this.assertSameRequest(existing, requestHash);
      return retryFailed
        ? this.retryFailedDocument(matchingDocument, provider, invoice, context)
        : matchingDocument;
    }
    if (retryFailed) {
      throw new NotFoundException('No retryable billing document exists for this idempotency key.');
    }

    if (paymentIds.length > 0) {
      const payments = await this.prisma.payment.findMany({
        where: { id: { in: paymentIds }, tenantId },
        select: { id: true, billingDocumentId: true },
      });
      if (payments.length !== paymentIds.length) {
        throw new NotFoundException('One or more payments were not found for this tenant.');
      }
      if (payments.some(({ billingDocumentId }) => billingDocumentId)) {
        throw new ConflictException(
          'One or more payments are already attached to another billing document.',
        );
      }
    }

    if (orderIds.length > 1) {
      const orders = await this.prisma.order.findMany({
        where: { id: { in: orderIds }, tenantId },
        select: { id: true, locationId: true },
      });
      if (orders.length !== orderIds.length) {
        throw new NotFoundException('One or more orders were not found for this tenant.');
      }
      if (orders.some((order) => order.locationId !== locationId)) {
        throw new BadRequestException('Orders do not belong to the configured location.');
      }
    } else if (primaryOrderId) {
      const order = await this.prisma.order.findFirst({
        where: { id: primaryOrderId, tenantId },
        select: { id: true, locationId: true },
      });
      if (!order) {
        throw new NotFoundException('Order not found for this tenant.');
      }
      if (order.locationId !== locationId) {
        throw new BadRequestException('Order does not belong to the configured location.');
      }
    }

    let document: BillingDocument;
    try {
      document = await this.prisma.billingDocument.create({
        data: {
          tenantId,
          locationId,
          orderId: primaryOrderId,
          countryCode,
          providerName: provider.name,
          type: BillingDocumentType.SALES_INVOICE,
          status: BillingDocumentStatus.PENDING,
          idempotencyKey,
          referenceCode,
          requestHash,
          requestPayload: JSON.parse(JSON.stringify(invoice)) as Prisma.InputJsonValue,
          ...(orderIds.length > 0
            ? {
                orderLinks: {
                  create: orderIds.map((orderId) => ({
                    order: { connect: { id: orderId } },
                  })),
                },
              }
            : {}),
          ...(paymentIds.length > 0
            ? {
                payments: {
                  connect: paymentIds.map((id) => ({ id })),
                },
              }
            : {}),
        },
      });
    } catch (error) {
      if (!hasPrismaErrorCode(error, 'P2002')) {
        throw error;
      }
      const concurrentDocument = await this.prisma.billingDocument.findUnique({
        where: {
          tenantId_locationId_idempotencyKey: { tenantId, locationId, idempotencyKey },
        },
      });
      if (!concurrentDocument) {
        throw error;
      }
      const matchingDocument = this.assertSameRequest(concurrentDocument, requestHash);
      return retryFailed
        ? this.retryFailedDocument(matchingDocument, provider, invoice, context)
        : matchingDocument;
    }

    return this.submitInvoice(document, provider, invoice, context);
  }

  private async retryFailedDocument(
    document: BillingDocument,
    provider: BillingProvider,
    invoice: ReturnType<typeof parseBillingInvoiceInput>,
    context: BillingProviderContext,
  ): Promise<BillingDocument> {
    if (document.status !== BillingDocumentStatus.FAILED_RETRYABLE) {
      return document;
    }

    const claim = await this.prisma.billingDocument.updateMany({
      where: {
        id: document.id,
        tenantId: document.tenantId,
        status: BillingDocumentStatus.FAILED_RETRYABLE,
      },
      data: {
        status: BillingDocumentStatus.PENDING,
        errorCode: null,
        errorMessage: null,
      },
    });
    if (claim.count === 0) {
      const currentDocument = await this.prisma.billingDocument.findFirst({
        where: { id: document.id, tenantId: document.tenantId },
      });
      if (!currentDocument) {
        throw new NotFoundException('Billing document no longer exists.');
      }
      return currentDocument;
    }

    return this.submitInvoice(document, provider, invoice, context);
  }

  private async submitInvoice(
    document: Pick<BillingDocument, 'id' | 'referenceCode'>,
    provider: BillingProvider,
    invoice: ReturnType<typeof parseBillingInvoiceInput>,
    context: BillingProviderContext,
  ): Promise<BillingDocument> {
    let providerResult: BillingProviderResult;
    try {
      providerResult = await provider.issueInvoice(document.referenceCode, invoice, context);
    } catch (error) {
      const providerError =
        error instanceof BillingProviderError
          ? error
          : new BillingProviderError(
              'BILLING_PROVIDER_OUTCOME_UNKNOWN',
              'RECONCILIATION_REQUIRED',
              'The provider outcome is unknown; reconcile before retrying.',
            );
      const status = dispositionToStatus(providerError.disposition);
      this.logger.warn(
        `Billing provider submission failed: document=${document.id}; provider=${provider.name}; status=${status}; code=${providerError.code}; detail=${providerError.message}`,
      );
      await this.prisma.billingDocument.update({
        where: { id: document.id },
        data: {
          status,
          errorCode: providerError.code,
          errorMessage: providerError.message,
        },
      });
      throw new BillingEmissionError(
        document.id,
        status,
        providerError.code,
        providerError.message,
      );
    }

    this.logger.log(
      `Billing provider response received: document=${document.id}; provider=${provider.name}; status=${providerResult.status}; validated=${providerResult.isValidated}; validationCodes=${providerResult.errorCodes.join(',') || 'none'}`,
    );
    return this.prisma.billingDocument.update({
      where: { id: document.id },
      data: {
        status: providerResult.status,
        providerReferenceId: providerResult.providerReferenceId,
        documentNumber: providerResult.documentNumber,
        cufe: providerResult.cufe,
        responseMetadata: {
          isValidated: providerResult.isValidated,
          errorCodes: providerResult.errorCodes,
        },
        errorCode: providerResult.errorCodes.length ? 'FACTUS_VALIDATION_WARNINGS' : null,
        errorMessage: null,
      },
    });
  }

  async refreshInvoiceStatus(
    tenantId: string,
    billingDocumentId: string,
  ): Promise<BillingDocument> {
    const document = await this.prisma.billingDocument.findFirst({
      where: { id: billingDocumentId, tenantId },
    });
    if (!document) {
      throw new NotFoundException('Billing document not found for this tenant.');
    }
    if (
      document.status !== BillingDocumentStatus.PENDING &&
      document.status !== BillingDocumentStatus.FAILED_RETRYABLE &&
      document.status !== BillingDocumentStatus.RECONCILIATION_REQUIRED
    ) {
      throw new ConflictException('Only unresolved billing documents can be refreshed.');
    }

    const billingConfiguration = await this.locationConfigurations.getForEmission(
      tenantId,
      document.locationId,
    );
    if (billingConfiguration.countryCode !== document.countryCode) {
      throw new ConflictException(
        'The location billing country changed after this document was issued.',
      );
    }
    const provider = this.providers.forCountry(document.countryCode);
    this.assertSandboxEnabled(provider);
    let providerResult: BillingProviderResult | null;
    try {
      providerResult = document.providerReferenceId
        ? await provider.getInvoiceStatus(
            document.providerReferenceId,
            billingConfiguration.context,
          )
        : await provider.findInvoiceByReferenceCode(
            document.referenceCode,
            billingConfiguration.context,
          );
    } catch (error) {
      if (error instanceof BillingProviderError) {
        this.logger.warn(
          `Billing provider status check failed: document=${document.id}; provider=${provider.name}; code=${error.code}`,
        );
        throw new BadGatewayException({
          statusCode: 502,
          error: 'Billing provider status check failed',
          message: error.message,
          billingDocumentId: document.id,
          status: document.status,
          code: error.code,
        });
      }
      throw error;
    }

    if (!providerResult) {
      this.logger.log(
        `Billing provider status check returned no document: document=${document.id}; provider=${provider.name}`,
      );
      throw new ConflictException('Factus has not returned a document for this reference yet.');
    }

    this.logger.log(
      `Billing provider status received: document=${document.id}; provider=${provider.name}; status=${providerResult.status}; validated=${providerResult.isValidated}; validationCodes=${providerResult.errorCodes.join(',') || 'none'}`,
    );
    return this.prisma.billingDocument.update({
      where: { id: document.id },
      data: {
        status: providerResult.status,
        providerReferenceId: providerResult.providerReferenceId,
        documentNumber: providerResult.documentNumber,
        cufe: providerResult.cufe,
        responseMetadata: {
          isValidated: providerResult.isValidated,
          errorCodes: providerResult.errorCodes,
        },
        errorCode: providerResult.errorCodes.length ? 'FACTUS_VALIDATION_WARNINGS' : null,
        errorMessage: null,
      },
    });
  }

  private assertSameRequest(document: BillingDocument, requestHash: string): BillingDocument {
    if (document.requestHash !== requestHash) {
      throw new ConflictException(
        'This idempotency key was already used with a different invoice payload.',
      );
    }
    return document;
  }

  private assertSandboxEnabled(provider: BillingProvider): void {
    if (provider.name !== 'FACTUS') {
      return;
    }

    if (this.configService.get<string>('BILLING_ENV', '').trim().toLowerCase() !== 'sandbox') {
      throw new ForbiddenException('Factus billing is disabled unless BILLING_ENV=sandbox.');
    }
  }
}

function hashPayload(value: unknown): string {
  return createHash('sha256').update(stableSerialize(value)).digest('hex');
}

function normalizeOrderIds(command: EmitInvoiceCommand): string[] {
  return [...new Set([...(command.orderIds ?? []), ...(command.orderId ? [command.orderId] : [])])]
    .map((orderId) => orderId.trim())
    .filter(Boolean)
    .sort();
}

function normalizePaymentIds(command: EmitInvoiceCommand): string[] {
  return [...new Set((command.paymentIds ?? []).map((id) => id.trim()).filter(Boolean))].sort();
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(',')}]`;
  }
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableSerialize(entry)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function createReferenceCode(tenantId: string, locationId: string, idempotencyKey: string): string {
  return `K${createHash('sha256')
    .update(`${tenantId}:${locationId}:${idempotencyKey}`)
    .digest('hex')
    .slice(0, 31)}`;
}

function dispositionToStatus(
  disposition: BillingProviderError['disposition'],
): BillingDocumentStatus {
  switch (disposition) {
    case 'REJECTED':
      return BillingDocumentStatus.REJECTED;
    case 'FAILED_RETRYABLE':
      return BillingDocumentStatus.FAILED_RETRYABLE;
    case 'RECONCILIATION_REQUIRED':
      return BillingDocumentStatus.RECONCILIATION_REQUIRED;
  }
}

function hasPrismaErrorCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}
