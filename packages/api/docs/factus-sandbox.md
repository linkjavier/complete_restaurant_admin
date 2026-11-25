# Factus Sandbox billing

The billing module chooses a provider by the issuer's ISO 3166-1 alpha-2 country code. Colombia (`CO`) is currently mapped to Factus. Adding a provider for another country should implement `BillingProvider` and register its supported country codes; do not add country-specific request fields to the shared billing types.

The integration is deliberately Sandbox-only and has no public invoice-issuance endpoint or automatic order trigger. A Super Admin can configure an independent fiscal profile and Factus account for each location from **Admin → Configuración → Facturación electrónica**. The API scopes every profile to the authenticated tenant and the selected location; credentials are encrypted at rest and are never returned by the API.

The configured NIT and legal name must match the Factus account for that location. The numbering range is selected in Factus and its ID is stored with the profile. A complete profile is required for the internal test CLI. Establishment details are stored in Kutchen but are not yet mapped into the Factus invoice request. The UI does not enable automatic billing from orders.

## Local configuration

Set these values in a local ignored environment file. Do not commit credentials:

```env
BILLING_ENV=sandbox
BILLING_CREDENTIALS_ENCRYPTION_KEY=
FACTUS_SANDBOX_TEST_TENANT_ID=
FACTUS_SANDBOX_TEST_LOCATION_ID=
FACTUS_SANDBOX_TEST_PAYLOAD_FILE=/absolute/path/to/factus-sandbox-invoice.json
FACTUS_SANDBOX_TEST_IDEMPOTENCY_KEY=
```

Generate the encryption key with `openssl rand -base64 32`. Configure it only on the API server. Enter each location's Factus client ID, client secret, username, and password in the billing settings tab; do not put those credentials in `.env`.

The JSON payload file must contain only fictitious data accepted by the Factus Sandbox account. Its top-level shape is the provider-independent `BillingInvoiceInput`: `customer`, `items`, and `paymentDetails`. Use official Factus reference-table codes and confirm the test issuer/account relationship before making a live Sandbox request. Never use a real customer's data.

Run the controlled request from the repository root:

```sh
npm run billing:test:factus:sandbox --workspace=@blondie/api -- --live
```

The script requires `--live`, creates no order, and repeats the same request with the same idempotency key for the configured location. The second call must return the persisted document rather than submit another invoice. Use `--retry-failed` only to explicitly retry a document in `FAILED_RETRYABLE`; it reuses the same reference code and payload hash. Use a fresh key only when intentionally creating a separate Sandbox document.

Automated tests mock the provider and do not call Factus. A timeout or `409` leaves the document in reconciliation; do not delete, recreate, or retry it with a new reference code. The current implementation does not emit credit notes or POS equivalent documents and does not infer taxes, tips, payment mappings, or fiscal rules from existing Kutchen orders.
