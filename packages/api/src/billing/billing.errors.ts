import { HttpException } from '@nestjs/common';
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

export class BillingEmissionError extends HttpException {
  constructor(
    readonly billingDocumentId: string,
    readonly billingStatus: string,
    readonly code: string,
    message: string,
  ) {
    const httpStatus = billingStatus === 'REJECTED' ? 422 : 502;
    super(
      {
        statusCode: httpStatus,
        error: billingStatus === 'REJECTED' ? 'Invoice rejected' : 'Billing provider error',
        message,
        billingDocumentId,
        status: billingStatus,
        code,
      },
      httpStatus,
    );
    this.name = BillingEmissionError.name;
  }
}
