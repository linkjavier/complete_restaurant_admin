import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // DEBUG: imprime la URL real para ver cómo llega
    console.log('[TenantMiddleware] originalUrl:', req.originalUrl, 'path:', req.path);

    // Permitir acceso libre a cualquier petición que contenga /tenants, /auth/register o /auth/login
    if (
      req.originalUrl.includes('/tenants') ||
      req.originalUrl.includes('/auth/register') ||
      req.originalUrl.includes('/auth/login')
    ) {
      return next();
    }

    // Extraer subdominio (empresa1.tuapp.com)
    const hostHeader = req.headers.host;
    const host = hostHeader ? hostHeader.split(':')[0] : '';
    const parts = host.split('.');
    const subdomain = parts.length > 2 ? parts[0] : null;

    if (!subdomain) {
      throw new UnauthorizedException('No subdomain found in request');
    }

    // Buscar el tenantId en la base de datos
    const tenant = await this.prisma.tenant.findFirst({ where: { name: subdomain } });
    if (!tenant) {
      throw new UnauthorizedException('Tenant not found for subdomain');
    }

    // Adjuntar tenantId a la request
    (req as any).tenantId = tenant.id;
    next();
  }
} 