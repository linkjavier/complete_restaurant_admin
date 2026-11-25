export type BillingProviderName = 'FACTUS';

export type BillingProviderDisposition =
  | 'REJECTED'
  | 'FAILED_RETRYABLE'
  | 'RECONCILIATION_REQUIRED';

export interface BillingCustomer {
  identificationDocumentCode: string;
  identification: string;
  legalOrganizationCode: string;
  dv?: string;
  company?: string;
  tradeName?: string;
  names?: string;
  address?: string;
  email?: string;
  phone?: string;
  tributeCode?: string;
  countryCode?: string;
  responsibilities?: string[];
  municipalityCode?: string;
}

export interface BillingTax {
  code: string;
  rate: string;
  isExcluded?: boolean;
}

export interface BillingInvoiceItem {
  codeReference: string;
  name: string;
  quantity: string;
  unitPrice: string;
  unitMeasureCode: string;
  standardCode: string;
  discountRate?: string;
  discountAmount?: string;
  taxes: BillingTax[];
}

export interface BillingPaymentDetail {
  paymentForm: string;
  paymentMethodCode: string;
  amount: string;
  referenceCode?: string;
  dueDate?: string;
}

export interface BillingInvoiceInput {
  customer: BillingCustomer;
  items: BillingInvoiceItem[];
  paymentDetails: BillingPaymentDetail[];
  numberingRangeId?: number;
  operationType?: string;
  observation?: string;
}

export interface EmitInvoiceCommand {
  tenantId: string;
  locationId: string;
  idempotencyKey: string;
  invoice: BillingInvoiceInput;
  orderId?: string;
}

export interface BillingProviderContext {
  credentials: Readonly<Record<string, string>>;
  numberingRangeId?: number;
}

export interface BillingProviderResult {
  status: 'PENDING' | 'ACCEPTED';
  providerReferenceId: string;
  documentNumber?: string;
  cufe?: string;
  errorCodes: string[];
  isValidated: boolean;
}

export interface BillingProvider {
  readonly name: BillingProviderName;
  readonly supportedCountries: readonly string[];
  issueInvoice(
    referenceCode: string,
    invoice: BillingInvoiceInput,
    context: BillingProviderContext,
  ): Promise<BillingProviderResult>;
  getInvoiceStatus(
    providerReferenceId: string,
    context: BillingProviderContext,
  ): Promise<BillingProviderResult>;
  findInvoiceByReferenceCode(
    referenceCode: string,
    context: BillingProviderContext,
  ): Promise<BillingProviderResult | null>;
}
