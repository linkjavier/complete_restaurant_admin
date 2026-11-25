import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { BillingModule } from '../src/billing/billing.module';
import { BillingService } from '../src/billing/billing.service';
import { parseBillingInvoiceInput } from '../src/billing/billing.validation';
import { BillingEmissionError } from '../src/billing/billing.errors';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
    }),
    BillingModule,
  ],
})
class FactusSandboxTestModule {}

async function main(): Promise<void> {
  if (!process.argv.includes('--live')) {
    throw new Error('Refusing to call Factus without the explicit --live flag.');
  }

  const app = await NestFactory.createApplicationContext(FactusSandboxTestModule);

  try {
    const tenantId = process.env.FACTUS_SANDBOX_TEST_TENANT_ID?.trim();
    const locationId = process.env.FACTUS_SANDBOX_TEST_LOCATION_ID?.trim();
    const payloadPath = process.env.FACTUS_SANDBOX_TEST_PAYLOAD_FILE?.trim();
    const idempotencyKey = process.env.FACTUS_SANDBOX_TEST_IDEMPOTENCY_KEY?.trim();

    if (!tenantId || !locationId || !payloadPath || !idempotencyKey) {
      throw new Error(
        'Set FACTUS_SANDBOX_TEST_TENANT_ID, FACTUS_SANDBOX_TEST_LOCATION_ID, FACTUS_SANDBOX_TEST_PAYLOAD_FILE, and FACTUS_SANDBOX_TEST_IDEMPOTENCY_KEY.',
      );
    }

    const rawPayload: unknown = JSON.parse(await readFile(resolve(payloadPath), 'utf8'));
    const invoice = parseBillingInvoiceInput(rawPayload);
    const billingService = app.get(BillingService);
    const issue = process.argv.includes('--retry-failed')
      ? billingService.retryInvoice.bind(billingService)
      : billingService.issueInvoice.bind(billingService);
    const command = {
      tenantId,
      locationId,
      idempotencyKey,
      invoice,
    };
    const first = await issue(command);
    const repeated = await billingService.issueInvoice(command);

    if (first.id !== repeated.id) {
      throw new Error('Idempotency check returned different billing documents.');
    }

    console.log(
      JSON.stringify({
        documentId: first.id,
        status: repeated.status,
        documentNumber: repeated.documentNumber,
        repeatedRequestReusedDocument: true,
      }),
    );
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  if (error instanceof BillingEmissionError) {
    console.error(
      JSON.stringify({
        documentId: error.billingDocumentId,
        status: error.status,
        code: error.code,
        message: error.message,
      }),
    );
    process.exitCode = 1;
    return;
  }
  const message = error instanceof Error ? error.message : 'Sandbox test failed.';
  console.error(message);
  process.exitCode = 1;
});
