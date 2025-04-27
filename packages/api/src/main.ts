import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { swaggerConfig } from './swagger.config';
import { ConfigService } from '@nestjs/config';
import { RedisIoAdapter } from './orders/socket-io-redis.adapter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  try {
    const app = await NestFactory.create(AppModule);
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

    // Enable CORS
    app.enableCors();

    // Enable validation
    app.useGlobalPipes(new ValidationPipe());

    // Swagger documentation
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api', app, document);

    const port = configService.get('PORT', '3000');
    await app.listen(port);
    logger.log(`Application is running on: http://localhost:${port}`);
  } catch (error) {
    logger.error(`Error during application bootstrap: ${error.message}`, error.stack);
    process.exit(1);
  }
}
bootstrap(); 