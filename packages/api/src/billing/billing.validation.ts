import { BadRequestException } from '@nestjs/common';
import { BillingInvoiceInput } from './billing.types';

const MONEY_PATTERN = /^\d{1,12}(?:\.\d{1,2})?$/;
const RATE_PATTERN = /^\d{1,3}(?:\.\d{1,2})?$/;

export function parseBillingInvoiceInput(value: unknown): BillingInvoiceInput {
  validateInvoice(value);
  return value;
}

function validateInvoice(value: unknown): asserts value is BillingInvoiceInput {
  if (!isRecord(value)) {
    throw new BadRequestException('Invoice payload is required.');
  }
  const customer = value.customer;
  if (
    !isRecord(customer) ||
    !isNonEmptyString(customer.identificationDocumentCode) ||
    !isNonEmptyString(customer.identification) ||
    !isNonEmptyString(customer.legalOrganizationCode) ||
    (customer.legalOrganizationCode === '1' && !isNonEmptyString(customer.company)) ||
    (customer.legalOrganizationCode === '2' && !isNonEmptyString(customer.names))
  ) {
    throw new BadRequestException(
      'Customer identification and legal organization fields are required.',
    );
  }
  const optionalCustomerStrings = [
    'dv',
    'tradeName',
    'address',
    'email',
    'phone',
    'tributeCode',
    'countryCode',
    'municipalityCode',
  ];
  if (
    optionalCustomerStrings.some(
      (key) => customer[key] !== undefined && !isNonEmptyString(customer[key]),
    ) ||
    (customer.countryCode !== undefined &&
      (typeof customer.countryCode !== 'string' || customer.countryCode.length !== 2)) ||
    (customer.responsibilities !== undefined &&
      (!Array.isArray(customer.responsibilities) ||
        customer.responsibilities.length === 0 ||
        customer.responsibilities.some(
          (responsibility: unknown) => !isNonEmptyString(responsibility),
        )))
  ) {
    throw new BadRequestException('Optional customer tax data is invalid.');
  }
  if (!Array.isArray(value.items) || value.items.length === 0) {
    throw new BadRequestException('At least one invoice item is required.');
  }
  for (const item of value.items) {
    if (
      !isRecord(item) ||
      !isNonEmptyString(item.codeReference) ||
      !isNonEmptyString(item.name) ||
      !isPositiveDecimal(item.quantity, MONEY_PATTERN) ||
      !isNonNegativeDecimal(item.unitPrice) ||
      !isNonEmptyString(item.unitMeasureCode) ||
      !isNonEmptyString(item.standardCode) ||
      !Array.isArray(item.taxes) ||
      item.taxes.length === 0
    ) {
      throw new BadRequestException('Invoice item data is incomplete or invalid.');
    }
    if (item.discountRate !== undefined && item.discountAmount !== undefined) {
      throw new BadRequestException(
        'Use either a discount rate or a discount amount per item, not both.',
      );
    }
    if (
      item.discountRate !== undefined &&
      (!isNonNegativeDecimal(item.discountRate, RATE_PATTERN) || Number(item.discountRate) > 100)
    ) {
      throw new BadRequestException('Invoice item discount rate is invalid.');
    }
    if (item.discountAmount !== undefined && !isNonNegativeDecimal(item.discountAmount)) {
      throw new BadRequestException('Invoice item discount amount is invalid.');
    }
    for (const tax of item.taxes) {
      if (
        !isRecord(tax) ||
        !isNonEmptyString(tax.code) ||
        !isNonNegativeDecimal(tax.rate, RATE_PATTERN) ||
        Number(tax.rate) > 100 ||
        (tax.isExcluded !== undefined && typeof tax.isExcluded !== 'boolean')
      ) {
        throw new BadRequestException('Invoice item tax data is invalid.');
      }
    }
  }
  if (!Array.isArray(value.paymentDetails) || value.paymentDetails.length === 0) {
    throw new BadRequestException('At least one payment detail is required by Factus.');
  }
  for (const payment of value.paymentDetails) {
    if (
      !isRecord(payment) ||
      !isNonEmptyString(payment.paymentForm) ||
      !isNonEmptyString(payment.paymentMethodCode) ||
      !isPositiveDecimal(payment.amount, MONEY_PATTERN) ||
      (payment.dueDate !== undefined && !isValidDate(payment.dueDate)) ||
      (payment.referenceCode !== undefined && !isNonEmptyString(payment.referenceCode)) ||
      (payment.paymentForm === '2' && payment.dueDate === undefined)
    ) {
      throw new BadRequestException('Invoice payment data is invalid.');
    }
  }
  if (
    value.numberingRangeId !== undefined &&
    (typeof value.numberingRangeId !== 'number' ||
      !Number.isInteger(value.numberingRangeId) ||
      value.numberingRangeId <= 0)
  ) {
    throw new BadRequestException('Factus numbering range ID is invalid.');
  }
  if (value.operationType !== undefined && !isNonEmptyString(value.operationType)) {
    throw new BadRequestException('Factus operation type is invalid.');
  }
  if (
    value.observation !== undefined &&
    (typeof value.observation !== 'string' || value.observation.length > 500)
  ) {
    throw new BadRequestException('Invoice observation is invalid.');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPositiveDecimal(value: unknown, pattern: RegExp): value is string {
  return (
    isNonNegativeDecimal(value, pattern) && value.split('.').some((part) => /[1-9]/.test(part))
  );
}

function isNonNegativeDecimal(value: unknown, pattern: RegExp = MONEY_PATTERN): value is string {
  return typeof value === 'string' && pattern.test(value);
}

function isValidDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}
