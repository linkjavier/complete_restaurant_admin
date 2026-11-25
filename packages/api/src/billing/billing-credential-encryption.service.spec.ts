import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import {
  BillingCredentialEncryptionService,
  FactusCredentials,
} from './billing-credential-encryption.service';

describe('BillingCredentialEncryptionService', () => {
  let service: BillingCredentialEncryptionService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        BillingCredentialEncryptionService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              key === 'BILLING_CREDENTIALS_ENCRYPTION_KEY'
                ? Buffer.alloc(32, 7).toString('base64')
                : undefined,
          },
        },
      ],
    }).compile();
    service = moduleRef.get(BillingCredentialEncryptionService);
  });

  it('encrypts credentials at rest and decrypts them for the provider', () => {
    const credentials: FactusCredentials = {
      clientId: 'sandbox-client',
      clientSecret: 'client-secret-value',
      username: 'sandbox-user',
      password: 'account-password',
    };

    const encrypted = service.encrypt(credentials);

    expect(encrypted).not.toContain(credentials.clientSecret);
    expect(encrypted).not.toContain(credentials.password);
    expect(service.decrypt(encrypted)).toEqual(credentials);
  });
});
