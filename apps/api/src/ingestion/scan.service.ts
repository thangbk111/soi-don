import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import type { EventType, ScanJob } from '@soi-don/db';
import { Prisma } from '@soi-don/db';
import type { DateRange } from '@soi-don/shared';
import { AuditService } from '../audit/audit.service';
import { isShopeeSender } from '../gmail/gmail.constants';
import { GmailRevokedError, GmailService, mapLimit } from '../gmail/gmail.service';
import { TokenBucket, withBackoff } from '../gmail/rate-limit';
import { PARSER_SET_VERSION, parseEmail } from '../parser/registry';
import { PrismaService } from '../prisma/prisma.service';
import { extractHtml, header } from './gmail-message';
import { Normalizer } from './normalizer';

/**
 * Email giao hàng đến sau ngày đặt vài ngày → đọc email thêm một khoảng sau ngày cuối
 * để đơn đặt cuối kỳ vẫn đủ dữ liệu.
 */
export const DELIVERY_LAG_DAYS = 30;
const DAY_MS = 24 * 3600 * 1000;
const UNITS_PER_SEC = 100;
const COST = 5; // messages.list / messages.get / attachments.get
const PROGRESS_EVERY = 10;

export function emailWindow(orderStart: Date, orderEndExclusive: Date, now = new Date()) {
  const before = new Date(
    Math.min(now.getTime(), orderEndExclusive.getTime() + DELIVERY_LAG_DAYS * DAY_MS),
  );
  return { after: orderStart, before };
}

/**
 * Quét Gmail chạy nền trong process API, tiến độ lưu ở ScanJob.
 * TODO(plan §7): chuyển sang BullMQ queue `gmail-scan` khi có worker riêng.
 */
@Injectable()
export class ScanService implements OnModuleInit {
  private readonly logger = new Logger(ScanService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gmail: GmailService,
    private readonly normalizer: Normalizer,
    private readonly audit: AuditService,
  ) {}

  /** Job đang chạy dở khi server tắt sẽ không bao giờ xong → đánh dấu FAILED. */
  async onModuleInit() {
    await this.prisma.scanJob.updateMany({
      where: { status: { in: ['QUEUED', 'RUNNING'] } },
      data: {
        status: 'FAILED',
        error: 'Server khởi động lại khi đang quét',
        finishedAt: new Date(),
      },
    });
  }

  latest(userId: string): Promise<ScanJob | null> {
    return this.prisma.scanJob.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } });
  }

  async start(userId: string, range: DateRange, start: Date, endExclusive: Date): Promise<ScanJob> {
    const running = await this.prisma.scanJob.findFirst({
      where: { userId, status: { in: ['QUEUED', 'RUNNING'] } },
    });
    if (running) return running;
    // rangeFrom/rangeTo = khoảng ngày đặt hàng [from, to+1 ngày).
    const job = await this.prisma.scanJob.create({
      data: { userId, rangeFrom: start, rangeTo: endExclusive },
    });
    await this.audit.log(userId, 'scan.started', { from: range.from, to: range.to });
    this.run(job).catch(async (e: unknown) => {
      const revoked = e instanceof GmailRevokedError;
      this.logger.error(`scan ${job.id} failed: ${(e as Error).message}`);
      if (!revoked) Sentry.captureException(e, { tags: { job: 'scan' } });
      await this.prisma.scanJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          finishedAt: new Date(),
          error: revoked ? 'GMAIL_REVOKED' : 'Quét thất bại. Thử lại sau ít phút.',
        },
      });
    });
    return job;
  }

  private async run(job: ScanJob) {
    const { userId } = job;
    await this.prisma.scanJob.update({
      where: { id: job.id },
      data: { status: 'RUNNING', startedAt: new Date() },
    });

    const client = await this.gmail.clientFor(userId);
    const bucket = new TokenBucket(UNITS_PER_SEC);
    const ids = await this.gmail.listShopeeMessageIds(
      client,
      emailWindow(job.rangeFrom, job.rangeTo),
      bucket,
    );
    await this.prisma.scanJob.update({
      where: { id: job.id },
      data: { totalMessages: ids.length },
    });

    // Bỏ qua email đã parse thành công bằng đúng phiên bản parser hiện tại.
    const done = new Set(
      (
        await this.prisma.processedEmail.findMany({
          where: {
            userId,
            gmailMessageId: { in: ids },
            parsedOk: true,
            parserVersion: PARSER_SET_VERSION,
          },
          select: { gmailMessageId: true },
        })
      ).map((p) => p.gmailMessageId),
    );

    const c = { processed: 0, parsedOk: 0, failed: 0 };
    const flush = () => this.prisma.scanJob.update({ where: { id: job.id }, data: { ...c } });

    await mapLimit(ids, 4, async (id) => {
      try {
        if (done.has(id)) c.parsedOk++;
        else if (await this.processMessage(userId, client, bucket, id)) c.parsedOk++;
        else c.failed++;
      } catch (e) {
        if (e instanceof GmailRevokedError) throw e;
        c.failed++;
        this.logger.warn(`message ${id} failed: ${(e as Error).message}`);
        Sentry.captureException(e, { tags: { job: 'scan.message' } });
      }
      c.processed++;
      if (c.processed % PROGRESS_EVERY === 0) await flush();
    });

    await this.prisma.scanJob.update({
      where: { id: job.id },
      data: { ...c, status: 'DONE', finishedAt: new Date() },
    });
    await this.prisma.emailConnection.update({
      where: { userId_provider: { userId, provider: 'gmail' } },
      data: { lastSyncedAt: new Date() },
    });
    await this.audit.log(userId, 'scan.done', { total: ids.length, ...c });
  }

  /** Trả về true nếu email được parse thành công. Email không phải đơn hàng → false. */
  private async processMessage(
    userId: string,
    client: Awaited<ReturnType<GmailService['clientFor']>>,
    bucket: TokenBucket,
    id: string,
  ): Promise<boolean> {
    await bucket.take(COST);
    const msg = (
      await withBackoff(() => client.users.messages.get({ userId: 'me', id, format: 'full' }))
    ).data;
    const receivedAt = new Date(Number(msg.internalDate ?? Date.now()));
    const from = header(msg, 'From');
    const subject = header(msg, 'Subject');

    // Không tin hoàn toàn vào query: kiểm tra lại người gửi.
    const html = isShopeeSender(from)
      ? await extractHtml(client, msg, () => bucket.take(COST))
      : null;
    const result = html ? parseEmail({ messageId: id, from, subject, receivedAt, html }) : null;
    const events = result?.events ?? [];
    const ok = events.length > 0;

    for (const ev of events) {
      try {
        await this.normalizer.apply(userId, id, ev);
      } catch (e) {
        // Hai email của cùng một đơn xử lý song song → cùng tạo Transaction. Thử lại sẽ thành update.
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          await this.normalizer.apply(userId, id, ev);
        } else throw e;
      }
    }

    const data = {
      receivedAt,
      templateId: result?.parser.id ?? null,
      parserVersion: PARSER_SET_VERSION,
      eventType: (events[0]?.eventType ?? 'UNKNOWN') as EventType,
      parsedOk: ok,
    };
    await this.prisma.processedEmail.upsert({
      where: { userId_gmailMessageId: { userId, gmailMessageId: id } },
      update: data,
      create: { userId, gmailMessageId: id, ...data },
    });
    return ok;
  }
}
