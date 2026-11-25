import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

export interface FactusCredentials extends Record<string, string> {
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
}

@Injectable()
export class BillingCredentialEncryptionService {
  constructor(private readonly configService: ConfigService) {}

  encrypt(credentials: FactusCredentials): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.getEncryptionKey(), iv);
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(credentials), 'utf8'),
      cipher.final(),
    ]);
    return [
      iv.toString('base64'),
      cipher.getAuthTag().toString('base64'),
      encrypted.toString('base64'),
    ].join('.');
  }

  decrypt(value: string): FactusCredentials {
    const [encodedIv, encodedTag, encodedData] = value.split('.');
    if (!encodedIv || !encodedTag || !encodedData) {
      throw new ServiceUnavailableException(
        'Stored billing credentials have an invalid encrypted format.',
      );
    }

    try {
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.getEncryptionKey(),
        Buffer.from(encodedIv, 'base64'),
      );
      decipher.setAuthTag(Buffer.from(encodedTag, 'base64'));
      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(encodedData, 'base64')),
        decipher.final(),
      ]).toString('utf8');
      const parsed: unknown = JSON.parse(decrypted);
      if (!isFactusCredentials(parsed)) {
        throw new ServiceUnavailableException('Stored billing credentials have an invalid format.');
      }
      return parsed;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      throw new ServiceUnavailableException('Stored billing credentials could not be decrypted.');
    }
  }

  private getEncryptionKey(): Buffer {
    const encodedKey = this.configService.get<string>('BILLING_CREDENTIALS_ENCRYPTION_KEY', '');
    const key = Buffer.from(encodedKey, 'base64');
    if (key.length !== 32) {
      throw new ServiceUnavailableException(
        'BILLING_CREDENTIALS_ENCRYPTION_KEY must be a base64-encoded 32-byte key.',
      );
    }
    return key;
  }
}

function isFactusCredentials(value: unknown): value is FactusCredentials {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const credentials = value as Record<string, unknown>;
  return (
    typeof credentials.clientId === 'string' &&
    typeof credentials.clientSecret === 'string' &&
    typeof credentials.username === 'string' &&
    typeof credentials.password === 'string'
  );
}
