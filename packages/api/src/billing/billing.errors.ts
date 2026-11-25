import { BillingProviderDisposition } from './billing.types';

export class BillingProviderError extends Error {
  constructor(
    readonly code: string,
    readonly disposition: BillingProviderDisposition,
    message: string,
  ) {
    super(message);
    this.name = BillingProviderError.name;
  }
}

export class BillingEmissionError extends Error {
  constructor(
    readonly billingDocumentId: string,
    readonly status: string,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = BillingEmissionError.name;
  }
}
