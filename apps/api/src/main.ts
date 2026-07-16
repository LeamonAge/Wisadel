import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './shared/api-exception.filter';
import { resolve } from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { cors: false });
  const origins = [process.env.APP_ORIGIN ?? 'http://localhost:5173', process.env.ADMIN_ORIGIN ?? 'http://localhost:5174'];

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.enableCors({
    origin: (origin, callback) => callback(null, !origin || origin === 'null' || origins.includes(origin)),
    credentials: true,
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-Id']
  });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useStaticAssets(resolve(process.env.UPLOAD_DIR ?? './uploads'), { prefix: '/uploads/' });
  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
  console.log(`Wisadel API listening on http://localhost:${port}/api/v1`);
}

void bootstrap();
