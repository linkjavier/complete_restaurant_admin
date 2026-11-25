import { BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

describe('AuthService social login', () => {
  const tenant = { id: 'tenant-id', name: 'restaurant-test' };
  let prisma: { tenant: { findFirst: jest.Mock; findUnique: jest.Mock } };
  let jwtService: { signAsync: jest.Mock };
  let authService: AuthService;

  beforeEach(() => {
    prisma = {
      tenant: {
        findFirst: jest.fn().mockResolvedValue(tenant),
        findUnique: jest.fn(),
      },
    };
    jwtService = {
      signAsync: jest.fn().mockResolvedValue('signed-state'),
    };
    const configService = {
      get: jest.fn((key: string, defaultValue?: string) => {
        const values: Record<string, string> = {
          FRONTEND_URL: 'https://kutchen.online',
          GOOGLE_CLIENT_ID: 'test-client-id',
          GOOGLE_CLIENT_SECRET: 'test-client-secret',
          GOOGLE_CALLBACK_URL: 'https://api.kutchen.xyz/auth/google/callback',
        };
        return values[key] ?? defaultValue;
      }),
    };
    authService = new AuthService(
      prisma as unknown as PrismaService,
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService,
    );
  });

  it('resolves the tenant from the return subdomain for shared API OAuth redirects', async () => {
    await authService.createSocialAuthorizationUrl(
      'google',
      'default-tenant',
      'https://restaurant-test.kutchen.online',
      '8f14e45f-ea1f-4e8f-a8f1-811e0b3e8b99',
    );

    expect(prisma.tenant.findFirst).toHaveBeenCalledWith({
      where: { name: { equals: 'restaurant-test', mode: 'insensitive' } },
    });
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: tenant.id,
        returnTo: 'https://restaurant-test.kutchen.online',
        mode: 'login',
      }),
      { expiresIn: '10m' },
    );
  });

  it('rejects a return subdomain that does not resolve to a tenant', async () => {
    prisma.tenant.findFirst.mockResolvedValue(null);

    await expect(
      authService.createSocialAuthorizationUrl(
        'google',
        'default-tenant',
        'https://unknown.kutchen.online',
        '8f14e45f-ea1f-4e8f-a8f1-811e0b3e8b99',
      ),
    ).rejects.toThrow(BadRequestException);
    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });
});
