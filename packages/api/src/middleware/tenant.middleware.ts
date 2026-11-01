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

      // Rutas públicas que no requieren tenant
      const publicPaths = [
        '/auth/register',
        '/auth/login',
        '/auth/google',
        '/auth/facebook',
        '/auth/oauth',
        '/settings/business',
        '/payments/stripe/checkout',
        '/payments/test/checkout',
        '/payments/register-with-payment',
        '/health'
      ];

      // Verificar si la ruta actual es pública
      const isPublicPath = publicPaths.some(path => req.path.startsWith(path));

      // Log para depuración del header Host
      console.log('[TenantMiddleware] Host header:', req.headers.host);
      const hostHeader = req.headers.host;
      const host = hostHeader ? hostHeader.split(':')[0] : '';
      
      let tenantId: string | null = null;
      let tenant = null;

      // 1. Intentar resolver tenant desde localhost o subdominio
      if (host === 'localhost' || host === '127.0.0.1') {
        console.log('[TenantMiddleware] Acceso localhost, asignando default-tenant preliminarmente');
        tenantId = 'default-tenant';
      } else {
        // Extraer subdominio (empresa1.tuapp.com)
        const parts = host.split('.');
        const subdomain = parts.length >= 2 ? parts[0].toLowerCase() : null;

        if (subdomain) {
           // Buscar el tenantId en la base de datos (insensible a mayúsculas/minúsculas)
           tenant = await this.prisma.tenant.findFirst({
            where: {
              name: {
                equals: subdomain,
                mode: 'insensitive',
              },
            },
          });
          
          if (tenant) {
            tenantId = tenant.id;
            console.log('[TenantMiddleware] Tenant encontrado para subdominio:', subdomain, 'ID:', tenant.id);
          } else {
             console.log('[TenantMiddleware] Tenant NO encontrado para subdominio:', subdomain);
          }
        }
      }

      // 2. Asignación final de tenantId
      if (tenantId && tenantId !== 'default-tenant') {
        // Prioridad: Si encontramos un tenant real (no default), lo usamos.
        (req as any).tenantId = tenantId;
        console.log('[TenantMiddleware] Asignando tenant real:', tenantId);
        return next();
      }

      // 3. Fallback para rutas públicas: si no hay tenant real, usar default-tenant o permitir pasar si ya es default
      if (isPublicPath) {
        console.log('[TenantMiddleware] Ruta pública permitida (fallback default-tenant):', req.path);
        if (!(req as any).tenantId) {
             (req as any).tenantId = 'default-tenant';
        }
        return next();
      }

      // 4. Si llegamos aquí y no es pública ni tenemos tenant... error
      // Atención: Si estábamos en localhost (tenantId='default-tenant') y NO es pública, 
      // ¿deberíamos permitirlo? El código original permitía todo en localhost.
      if (host === 'localhost' || host === '127.0.0.1') {
         console.log('[TenantMiddleware] Acceso permitido en localhost (fallback):', req.path);
         (req as any).tenantId = 'default-tenant';
         return next();
      }

      if (!tenant) {
         // Si intentó buscar y no encontró
         return res.status(401).json({
          message: 'Tenant not found for subdomain',
          error: 'Unauthorized',
          statusCode: 401,
        });
      }

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