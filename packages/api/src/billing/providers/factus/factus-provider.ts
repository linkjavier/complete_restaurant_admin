import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosRequestConfig } from 'axios';
import { createHash } from 'crypto';
import {
  BillingCustomer,
  BillingInvoiceInput,
  BillingProvider,
  BillingProviderContext,
  BillingProviderResult,
} from '../../billing.types';
import { BillingProviderError } from '../../billing.errors';

const SANDBOX_URL = 'https://api-sandbox.factus.com.co';
const REQUEST_TIMEOUT_MS = 15_000;

interface FactusConfiguration {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
}

interface CachedToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

@Injectable()
export class FactusProvider implements BillingProvider {
  readonly name = 'FACTUS' as const;
  readonly supportedCountries = ['CO'] as const;

  private readonly cachedTokens = new Map<string, CachedToken>();
  private readonly tokenRequests = new Map<string, Promise<string>>();

  constructor(private readonly configService: ConfigService) {}

  async issueInvoice(
    referenceCode: string,
    invoice: BillingInvoiceInput,
    context: BillingProviderContext,
  ): Promise<BillingProviderResult> {
    const body = toFactusInvoiceRequest(referenceCode, invoice, context.numberingRangeId);
    const response = await this.request('POST', '/v2/bills/validate', context, body);
    return parseFactusBill(response, referenceCode);
  }

  async getInvoiceStatus(
    providerReferenceId: string,
    context: BillingProviderContext,
  ): Promise<BillingProviderResult> {
    const response = await this.request(
      'GET',
      `/v2/bills/${encodeURIComponent(providerReferenceId)}`,
      context,
    );
    return parseFactusBill(response);
  }

  async findInvoiceByReferenceCode(
    referenceCode: string,
    context: BillingProviderContext,
  ): Promise<BillingProviderResult | null> {
    const response = await this.request('GET', '/v2/bills', context, undefined, {
      'filter[reference_code]': referenceCode,
      'filter[per_page]': 1,
    });
    const root = asRecord(response);
    const pagination = asRecord(root?.data);
    const rows = pagination?.data;

    if (!Array.isArray(rows) || rows.length === 0) {
      return null;
    }

    const bill = rows[0];
    if (asRecord(bill)?.reference_code !== referenceCode) {
      return null;
    }

    return parseFactusBill({ data: bill }, referenceCode);
  }

  private async request(
    method: 'GET' | 'POST',
    path: string,
    context: BillingProviderContext,
    body?: Record<string, unknown>,
    params?: Record<string, string | number>,
  ): Promise<unknown> {
    const config = this.getConfiguration(context);
    const accessToken = await this.getAccessToken(config);
    const requestConfig: AxiosRequestConfig = {
      method,
      url: `${config.baseUrl}${path}`,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      timeout: REQUEST_TIMEOUT_MS,
      ...(params ? { params } : {}),
      ...(body ? { data: body } : {}),
    };

    try {
      const response = await axios.request<unknown>(requestConfig);
      return response.data;
    } catch (error) {
      throw toProviderError(error, 'DOCUMENT');
    }
  }

  private getConfiguration(context: BillingProviderContext): FactusConfiguration {
    const billingEnvironment = this.configService
      .get<string>('BILLING_ENV', '')
      .trim()
      .toLowerCase();
    if (billingEnvironment !== 'sandbox') {
      throw new BillingProviderError(
        'BILLING_ENV_NOT_SANDBOX',
        'FAILED_RETRYABLE',
        'Factus integration is enabled only when BILLING_ENV=sandbox.',
      );
    }

    const credentials = context.credentials;
    const clientId = this.requiredCredential(credentials, 'clientId');
    const clientSecret = this.requiredCredential(credentials, 'clientSecret');
    const username = this.requiredCredential(credentials, 'username');
    const password = this.requiredCredential(credentials, 'password');

    return {
      baseUrl: SANDBOX_URL,
      clientId,
      clientSecret,
      username,
      password,
    };
  }

  private requiredCredential(credentials: Readonly<Record<string, string>>, key: string): string {
    const value = credentials[key];
    if (!value) {
      throw new BillingProviderError(
        'FACTUS_CONFIGURATION_MISSING',
        'FAILED_RETRYABLE',
        `Missing required Factus credential: ${key}.`,
      );
    }
    return value;
  }

  private async getAccessToken(config: FactusConfiguration): Promise<string> {
    const cacheKey = createHash('sha256')
      .update(`${config.clientId}\0${config.clientSecret}\0${config.username}\0${config.password}`)
      .digest('hex');
    const cachedToken = this.cachedTokens.get(cacheKey);
    if (cachedToken && cachedToken.expiresAt > Date.now() + 15_000) {
      return cachedToken.accessToken;
    }
    const pendingRequest = this.tokenRequests.get(cacheKey);
    if (pendingRequest) {
      return pendingRequest;
    }

    const tokenRequest = this.refreshOrAuthenticate(config, cacheKey);
    this.tokenRequests.set(cacheKey, tokenRequest);
    try {
      return await tokenRequest;
    } finally {
      if (this.tokenRequests.get(cacheKey) === tokenRequest) {
        this.tokenRequests.delete(cacheKey);
      }
    }
  }

  private async refreshOrAuthenticate(
    config: FactusConfiguration,
    cacheKey: string,
  ): Promise<string> {
    const cachedToken = this.cachedTokens.get(cacheKey);
    const form = new URLSearchParams({
      grant_type: cachedToken ? 'refresh_token' : 'password',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      ...(cachedToken
        ? { refresh_token: cachedToken.refreshToken }
        : { username: config.username, password: config.password }),
    });

    try {
      const response = await axios.post<unknown>(`${config.baseUrl}/oauth/token`, form, {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
          ...(cachedToken ? { Authorization: `Bearer ${cachedToken.accessToken}` } : {}),
        },
        timeout: REQUEST_TIMEOUT_MS,
      });
      const tokenData = asRecord(response.data);
      const accessToken = tokenData?.access_token;
      const refreshToken = tokenData?.refresh_token;
      const expiresIn = tokenData?.expires_in;
      if (
        typeof accessToken !== 'string' ||
        typeof refreshToken !== 'string' ||
        typeof expiresIn !== 'number' ||
        !Number.isFinite(expiresIn) ||
        expiresIn <= 0
      ) {
        throw new BillingProviderError(
          'FACTUS_AUTH_RESPONSE_INVALID',
          'FAILED_RETRYABLE',
          'Factus returned an invalid OAuth token response.',
        );
      }

      this.cachedTokens.set(cacheKey, {
        accessToken,
        refreshToken,
        expiresAt: Date.now() + Math.max(1, expiresIn - 15) * 1000,
      });
      return accessToken;
    } catch (error) {
      this.cachedTokens.delete(cacheKey);
      if (error instanceof BillingProviderError) {
        throw error;
      }
      throw toProviderError(error, 'AUTH');
    }
  }
}

export function toFactusInvoiceRequest(
  referenceCode: string,
  invoice: BillingInvoiceInput,
  configuredNumberingRangeId?: number,
): Record<string, unknown> {
  const numberingRangeId = configuredNumberingRangeId ?? invoice.numberingRangeId;
  return {
    reference_code: referenceCode,
    document: '01',
    send_email: false,
    ...(invoice.operationType ? { operation_type: invoice.operationType } : {}),
    ...(numberingRangeId !== undefined ? { numbering_range_id: numberingRangeId } : {}),
    ...(invoice.observation ? { observation: invoice.observation } : {}),
    customer: toFactusCustomer(invoice.customer),
    items: invoice.items.map((item) => ({
      code_reference: item.codeReference,
      name: item.name,
      quantity: item.quantity,
      price: item.unitPrice,
      unit_measure_code: item.unitMeasureCode,
      standard_code: item.standardCode,
      ...(item.discountRate !== undefined ? { discount_rate: item.discountRate } : {}),
      ...(item.discountAmount !== undefined ? { discount_amount: item.discountAmount } : {}),
      taxes: item.taxes.map((tax) => ({
        code: tax.code,
        rate: tax.rate,
        ...(tax.isExcluded !== undefined ? { is_excluded: tax.isExcluded } : {}),
      })),
    })),
    payment_details: invoice.paymentDetails.map((payment) => ({
      payment_form: payment.paymentForm,
      payment_method_code: payment.paymentMethodCode,
      amount: payment.amount,
      ...(payment.referenceCode ? { reference_code: payment.referenceCode } : {}),
      ...(payment.dueDate ? { due_date: payment.dueDate } : {}),
    })),
  };
}

function toFactusCustomer(customer: BillingCustomer): Record<string, unknown> {
  return {
    identification_document_code: customer.identificationDocumentCode,
    identification: customer.identification,
    legal_organization_code: customer.legalOrganizationCode,
    ...(customer.dv ? { dv: customer.dv } : {}),
    ...(customer.company ? { company: customer.company } : {}),
    ...(customer.tradeName ? { trade_name: customer.tradeName } : {}),
    ...(customer.names ? { names: customer.names } : {}),
    ...(customer.address ? { address: customer.address } : {}),
    ...(customer.email ? { email: customer.email } : {}),
    ...(customer.phone ? { phone: customer.phone } : {}),
    ...(customer.tributeCode ? { tribute_code: customer.tributeCode } : {}),
    ...(customer.countryCode ? { country_code: customer.countryCode } : {}),
    ...(customer.responsibilities ? { responsibilities: customer.responsibilities } : {}),
    ...(customer.municipalityCode ? { municipality_code: customer.municipalityCode } : {}),
  };
}

function parseFactusBill(response: unknown, expectedReferenceCode?: string): BillingProviderResult {
  const root = asRecord(response);
  const data = asRecord(root?.data);
  const referenceCode = data?.reference_code;
  const number = data?.number;
  const isValidated = data?.is_validated;
  if (!data || typeof number !== 'string' || typeof isValidated !== 'boolean') {
    throw new BillingProviderError(
      'FACTUS_RESPONSE_INVALID',
      'RECONCILIATION_REQUIRED',
      'Factus returned a response that could not be reconciled safely.',
    );
  }

  if (expectedReferenceCode && referenceCode !== expectedReferenceCode) {
    throw new BillingProviderError(
      'FACTUS_REFERENCE_MISMATCH',
      'RECONCILIATION_REQUIRED',
      'Factus returned a different document reference.',
    );
  }

  const errors = asRecord(data.errors);
  return {
    status: isValidated ? 'ACCEPTED' : 'PENDING',
    providerReferenceId: number,
    documentNumber: number,
    cufe: typeof data.cufe === 'string' ? data.cufe : undefined,
    errorCodes: errors ? Object.keys(errors) : [],
    isValidated,
  };
}

function toProviderError(error: unknown, stage: 'AUTH' | 'DOCUMENT'): BillingProviderError {
  if (!axios.isAxiosError<unknown>(error)) {
    return new BillingProviderError(
      stage === 'AUTH' ? 'FACTUS_AUTH_FAILED' : 'FACTUS_REQUEST_FAILED',
      stage === 'AUTH' ? 'FAILED_RETRYABLE' : 'RECONCILIATION_REQUIRED',
      stage === 'AUTH'
        ? 'Factus authentication failed before document submission.'
        : 'Factus request outcome is unknown; reconcile before retrying.',
    );
  }

  const status = error.response?.status;
  if (stage === 'AUTH') {
    return new BillingProviderError(
      status ? `FACTUS_AUTH_HTTP_${status}` : 'FACTUS_AUTH_NETWORK_ERROR',
      'FAILED_RETRYABLE',
      'Factus authentication failed before document submission.',
    );
  }
  if (status === 409) {
    return new BillingProviderError(
      'FACTUS_DOCUMENT_PENDING',
      'RECONCILIATION_REQUIRED',
      'Factus reports a pending document; reconcile its status before taking action.',
    );
  }
  if (status === 429) {
    return new BillingProviderError(
      'FACTUS_RATE_LIMITED',
      'FAILED_RETRYABLE',
      'Factus rate limit reached; retry only with the same idempotency key.',
    );
  }
  if (status === 401 || status === 403) {
    return new BillingProviderError(
      `FACTUS_DOCUMENT_HTTP_${status}`,
      'FAILED_RETRYABLE',
      'Factus authentication was rejected before the invoice was accepted.',
    );
  }
  if (status && status >= 400 && status < 500) {
    return new BillingProviderError(
      `FACTUS_DOCUMENT_HTTP_${status}`,
      'REJECTED',
      'Factus rejected the invoice request.',
    );
  }
  return new BillingProviderError(
    status ? `FACTUS_DOCUMENT_HTTP_${status}` : 'FACTUS_DOCUMENT_OUTCOME_UNKNOWN',
    'RECONCILIATION_REQUIRED',
    'Factus request outcome is unknown; reconcile before retrying.',
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
