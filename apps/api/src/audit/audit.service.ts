import { Injectable } from '@nestjs/common';
import type { Prisma } from '@soi-don/db';
import { PrismaService } from '../prisma/prisma.service';

/** `meta` không được chứa PII (email, tên, số tiền). */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(userId: string | null, action: string, meta?: Prisma.InputJsonValue): Promise<void> {
    await this.prisma.auditLog.create({ data: { userId, action, meta } });
  }
}
