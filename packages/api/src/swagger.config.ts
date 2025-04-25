import { DocumentBuilder } from '@nestjs/swagger';

export const swaggerConfig = new DocumentBuilder()
  .setTitle('Restaurant Admin API')
  .setDescription('API documentation for the Restaurant Admin application')
  .setVersion('1.0')
  .addBearerAuth()
  .build(); 