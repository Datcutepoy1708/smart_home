import { ConsoleLogger, ValidationPipe } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const logger = new ConsoleLogger({ json: true });
  const app = await NestFactory.create(AppModule, { logger });
  app.enableShutdownHooks();
  app.use((_request: Request, response: Response, next: NextFunction) => {
    const requestId = randomUUID();
    response.setHeader('X-Request-Id', requestId);
    response.on('finish', () =>
      logger.log({
        code: 'HTTP_REQUEST',
        requestId,
        status: response.statusCode,
      }),
    );
    next();
  });

  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  const corsOrigin = process.env.CORS_ORIGIN;
  app.enableCors({
    origin: !corsOrigin || corsOrigin === '*' ? true : corsOrigin.split(','),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }),
  );

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Smart Home IoT API')
      .setDescription('Backend API for the Smart Home IoT platform')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
  }

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
}
await bootstrap();
