import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { swaggerConfig } from './swagger.config';
import { ConfigService } from '@nestjs/config';
import { RedisIoAdapter } from './orders/socket-io-redis.adapter';
import * as express from 'express';
import { TenantMiddleware } from './middleware/tenant.middleware';
import { PrismaService } from './prisma/prisma.service';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  try {
    const app = await NestFactory.create(AppModule, {
      bodyParser: false,
      rawBody: true,
    });

    // Set body size limits
    app.use(
      express.json({
        limit: '15mb',
        verify: (request, _response, buffer) => {
          if (request.url?.startsWith('/webhooks/meta/whatsapp')) {
            (
              request as typeof request & { rawBody?: Buffer }
            ).rawBody = Buffer.from(buffer);
          }
        },
      }),
    );
    app.use(express.urlencoded({ limit: '15mb', extended: true }));
    
    const configService = app.get(ConfigService);

    // Configure Redis adapter for Socket.IO
    const redisIoAdapter = new RedisIoAdapter(app, configService);
    // Only try to connect to Redis if it's enabled
    const useRedisAdapter = configService.get('USE_REDIS_ADAPTER', 'true') === 'true';
    
    if (useRedisAdapter) {
      try {
        await redisIoAdapter.connectToRedis();
        app.useWebSocketAdapter(redisIoAdapter);
        logger.log('Using Redis adapter for Socket.IO clustering');
      } catch (error) {
        logger.error(`Failed to initialize Redis adapter: ${error.message}. Falling back to default adapter.`);
      }
    } else {
      logger.log('Redis adapter disabled by configuration, using default adapter');
    }

    const allowedOrigins = new Set(
      configService
        .get('CORS_ALLOWED_ORIGINS', 'http://localhost:3001')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    );
    const allowedHostSuffixes = configService
      .get('CORS_ALLOWED_HOST_SUFFIXES', 'localhost')
      .split(',')
      .map((hostname) => hostname.trim().toLowerCase().replace(/^\./, ''))
      .filter(Boolean);

    app.enableCors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.has(origin)) {
          return callback(null, true);
        }

        let parsedOrigin: URL;
        try {
          parsedOrigin = new URL(origin);
        } catch {
          return callback(null, false);
        }

        const hostname = parsedOrigin.hostname.toLowerCase();
        const isAllowedHost = allowedHostSuffixes.some(
          (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`),
        );
        const isSecureProtocol =
          parsedOrigin.protocol === 'https:' ||
          hostname === 'localhost' ||
          hostname.endsWith('.localhost');

        return callback(null, isAllowedHost && isSecureProtocol);
      },
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID'],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      optionsSuccessStatus: 200,
    });

    // Enable validation
    app.useGlobalPipes(new ValidationPipe());

    // Tenant middleware: extrae tenantId del subdominio
    const prisma = app.get(PrismaService);
    app.use(async (req, res, next) => {
      const tenantMiddleware = new TenantMiddleware(prisma);
      await tenantMiddleware.use(req, res, next);
    });

    // Swagger documentation
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api', app, document);

    const port = configService.get('PORT', '3000');
    await app.listen(port, '0.0.0.0');
    logger.log(`Application is running on: http://localhost:${port}`);
  } catch (error) {
    logger.error(`Error during application bootstrap: ${error.message}`, error.stack);
    process.exit(1);
  }
}
bootstrap(); 