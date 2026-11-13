import './instrument';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000', credentials: true });
  // Railway cấp cổng qua PORT.
  await app.listen(Number(process.env.PORT ?? process.env.API_PORT ?? 4000));
}
bootstrap();
