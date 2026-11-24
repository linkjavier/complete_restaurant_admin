import { NextFunction, Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { TenantMiddleware } from './tenant.middleware';

describe('TenantMiddleware', () => {
  const tenant = { id: 'tenant-id', name: 'san-jose' };
  let prisma: { tenant: { findFirst: jest.Mock } };
  let middleware: TenantMiddleware;

  beforeEach(() => {
    prisma = {
      tenant: {
        findFirst: jest.fn().mockResolvedValue(tenant),
      },
    };
    middleware = new TenantMiddleware(prisma as unknown as PrismaService);
  });

  it('resolves a tenant from X-Tenant-ID when requests use the shared API host', async () => {
    const request = {
      headers: { host: 'api.kutchen.xyz', 'x-tenant-id': 'San-Jose' },
      path: '/auth/login',
      originalUrl: '/auth/login',
    } as unknown as Request & { tenantId?: string };
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;
    const next = jest.fn() as NextFunction;

    await middleware.use(request, response, next);

    expect(prisma.tenant.findFirst).toHaveBeenCalledWith({
      where: { name: { equals: 'san-jose', mode: 'insensitive' } },
    });
    expect(request.tenantId).toBe(tenant.id);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('continues resolving tenants from the request subdomain', async () => {
    const request = {
      headers: { host: 'san-jose.kutchen.online' },
      path: '/auth/login',
      originalUrl: '/auth/login',
    } as unknown as Request & { tenantId?: string };
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;
    const next = jest.fn() as NextFunction;

    await middleware.use(request, response, next);

    expect(prisma.tenant.findFirst).toHaveBeenCalledWith({
      where: { name: { equals: 'san-jose', mode: 'insensitive' } },
    });
    expect(request.tenantId).toBe(tenant.id);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
