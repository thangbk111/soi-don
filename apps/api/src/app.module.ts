import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { SentryGlobalFilter, SentryModule } from '@sentry/nestjs/setup';
import { AuditService } from './audit/audit.service';
import { AuthController } from './auth/auth.controller';
import { AuthGuard } from './auth/auth.guard';
import { CategoriesController } from './categories/categories.controller';
import { CategoriesService } from './categories/categories.service';
import { CryptoService } from './common/crypto/crypto.service';
import { validateEnv } from './config/env';
import { DashboardController } from './dashboard/dashboard.controller';
import { GmailController } from './gmail/gmail.controller';
import { GmailService } from './gmail/gmail.service';
import { HealthController } from './health/health.controller';
import { Normalizer } from './ingestion/normalizer';
import { ScanController } from './ingestion/scan.controller';
import { ScanService } from './ingestion/scan.service';
import { TransactionsController } from './transactions/transactions.controller';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    SentryModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['../../.env'], validate: validateEnv }),
    PrismaModule,
  ],
  controllers: [
    HealthController,
    AuthController,
    GmailController,
    ScanController,
    TransactionsController,
    CategoriesController,
    DashboardController,
  ],
  providers: [
    // Báo lỗi 5xx / lỗi chưa xử lý cho Sentry; lỗi HTTP 4xx bị bỏ qua.
    { provide: APP_FILTER, useClass: SentryGlobalFilter },
    AuditService,
    CryptoService,
    AuthGuard,
    GmailService,
    Normalizer,
    ScanService,
    CategoriesService,
  ],
})
export class AppModule {}
