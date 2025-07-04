import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      // LOG: Imprime todas las cabeceras relevantes para debug
      console.log('[TenantMiddleware] HEADERS:', JSON.stringify(req.headers, null, 2));
      // DEBUG: imprime la URL real para ver cómo llega
      console.log('[TenantMiddleware] originalUrl:', req.originalUrl, 'path:', req.path);

      // Permitir acceso libre a cualquier petición que contenga /tenants, /auth/register, /auth/login, /locations, /categories, /products o /pos/tables
      // (Ya no asignar tenantId por defecto aquí, solo dejar pasar para que se resuelva por subdominio)
      // Elimina el bloque que asigna el primer tenant y el return next();

      // Permitir acceso libre a /auth/register y /auth/login en cualquier entorno
      const allowedLocalhostPaths = ['/auth/register', '/auth/login'];
      const hostHeader = req.headers.host;
      const host = hostHeader ? hostHeader.split(':')[0] : '';
      if (allowedLocalhostPaths.includes(req.path)) {
        console.log('[TenantMiddleware] Ruta permitida sin tenant:', req.path);
        return next();
      }

      // Log para depuración del header Host
      console.log('[TenantMiddleware] Host header:', req.headers.host);
      // Extraer subdominio (empresa1.tuapp.com)
      const parts = host.split('.');
      const subdomain = parts.length >= 2 ? parts[0].toLowerCase() : null;

      if (!subdomain) {
        console.log('[TenantMiddleware] No subdomain found. Host:', host);
        return res.status(401).json({
          message: 'No subdomain found in request',
          error: 'Unauthorized',
          statusCode: 401,
        });
      }

      // Buscar el tenantId en la base de datos (insensible a mayúsculas/minúsculas)
      const tenant = await this.prisma.tenant.findFirst({
        where: {
          name: {
            equals: subdomain,
            mode: 'insensitive',
          },
        },
      });
      if (!tenant) {
        console.log('[TenantMiddleware] Tenant not found for subdomain:', subdomain);
        return res.status(401).json({
          message: 'Tenant not found for subdomain',
          error: 'Unauthorized',
          statusCode: 401,
        });
      }
      (req as any).tenantId = tenant.id;
      console.log('[TenantMiddleware] tenantId asignado:', tenant.id, 'para subdominio:', subdomain);
      next();
    } catch (err) {
      console.error('TenantMiddleware error:', err);
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      next(err);
    }
  }
} 