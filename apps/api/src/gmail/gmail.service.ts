import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { gmail, gmail_v1 } from '@googleapis/gmail';
import { OAuth2Client } from 'google-auth-library';
import { classifyShopeeSubject, type DateRange, type OrderEmailKind } from '@soi-don/shared';
import { AuditService } from '../audit/audit.service';
import { CryptoService } from '../common/crypto/crypto.service';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { TokenBucket, withBackoff } from './rate-limit';
import {
  CONSENT_VERSION,
  type EmailWindow,
  GMAIL_SCOPE,
  isShopeeSender,
  shopeeQuery,
  subjectTemplate,
} from './gmail.constants';

export interface SpikeTemplate {
  kind: OrderEmailKind;
  subject: string;
  count: number;
  firstAt: string;
  lastAt: string;
}

export interface SpikeResult {
  range: DateRange;
  listed: number;
  shopeeSender: number;
  /** Email Shopee không phải loại đơn hàng (quảng cáo, cảnh báo…), chỉ đếm. */
  ignored: number;
  templates: SpikeTemplate[];
}

export interface SpikeState {
  status: 'RUNNING' | 'DONE' | 'FAILED';
  phase: 'listing' | 'reading' | 'done';
  listed: number;
  processed: number;
  /** Đang chờ quota Gmail hồi lại (ms), để FE hiển thị. */
  waitingMs: number;
  error?: string;
  revoked?: boolean;
  result?: SpikeResult;
  startedAt: string;
}

/** ~100 units/s = 6.000 units/phút, dưới trần per-user của Gmail. */
const UNITS_PER_SEC = 100;
const COST_LIST = 5;
const COST_GET = 5;

export class GmailRevokedError extends Error {}

@Injectable()
export class GmailService {
  private readonly logger = new Logger(GmailService.name);
  /** Phase 0 chỉ chạy local cho vài user → giữ state trong bộ nhớ là đủ. */
  private readonly spikes = new Map<string, SpikeState>();

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
  ) {}

  oauthClient() {
    return new OAuth2Client(
      this.config.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      this.config.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
      this.config.getOrThrow<string>('GMAIL_REDIRECT_URI'),
    );
  }

  connectUrl(state: string, loginHint: string) {
    return this.oauthClient().generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: true,
      scope: [GMAIL_SCOPE],
      state,
      login_hint: loginHint,
    });
  }

  async handleCallback(userId: string, code: string) {
    const { tokens } = await this.oauthClient().getToken(code);
    const scopes = (tokens.scope ?? '').split(' ').filter(Boolean);
    if (!scopes.includes(GMAIL_SCOPE)) {
      throw new BadRequestException('Bạn cần cho phép quyền đọc Gmail để tiếp tục');
    }
    if (!tokens.refresh_token) throw new BadRequestException('Google không trả refresh token');

    const refreshTokenEncrypted = this.crypto.encrypt(tokens.refresh_token);
    await this.prisma.emailConnection.upsert({
      where: { userId_provider: { userId, provider: 'gmail' } },
      update: { refreshTokenEncrypted, scopes, status: 'ACTIVE' },
      create: { userId, provider: 'gmail', refreshTokenEncrypted, scopes },
    });
    await this.audit.log(userId, 'gmail.connected', { consentVersion: CONSENT_VERSION, scopes });
  }

  async disconnect(userId: string) {
    const conn = await this.prisma.emailConnection.findUnique({
      where: { userId_provider: { userId, provider: 'gmail' } },
    });
    if (!conn) return;
    try {
      await this.oauthClient().revokeToken(this.crypto.decrypt(conn.refreshTokenEncrypted));
    } catch (e) {
      // Token có thể đã hết hạn/bị thu hồi phía Google — vẫn xóa ở phía mình.
      this.logger.warn(`revoke failed for connection ${conn.id}: ${(e as Error).message}`);
    }
    await this.prisma.emailConnection.delete({ where: { id: conn.id } });
    await this.audit.log(userId, 'gmail.disconnected');
  }

  async clientFor(userId: string): Promise<gmail_v1.Gmail> {
    const conn = await this.prisma.emailConnection.findUnique({
      where: { userId_provider: { userId, provider: 'gmail' } },
    });
    if (!conn || conn.status !== 'ACTIVE') throw new NotFoundException('Chưa kết nối Gmail');
    const auth = this.oauthClient();
    auth.setCredentials({ refresh_token: this.crypto.decrypt(conn.refreshTokenEncrypted) });
    try {
      await auth.getAccessToken();
    } catch (e) {
      if (String((e as Error).message).includes('invalid_grant')) {
        await this.prisma.emailConnection.update({
          where: { id: conn.id },
          data: { status: 'REVOKED' },
        });
        throw new GmailRevokedError('Gmail token bị thu hồi hoặc hết hạn');
      }
      throw e;
    }
    return gmail({ version: 'v1', auth });
  }

  async listShopeeMessageIds(
    client: gmail_v1.Gmail,
    window: EmailWindow,
    bucket: TokenBucket,
    onRetry?: (delayMs: number) => void,
  ): Promise<string[]> {
    const ids: string[] = [];
    let pageToken: string | undefined;
    do {
      await bucket.take(COST_LIST);
      const res = await withBackoff(
        () =>
          client.users.messages.list({
            userId: 'me',
            q: shopeeQuery(window),
            maxResults: 500,
            pageToken,
          }),
        { onRetry },
      );
      for (const m of res.data.messages ?? []) if (m.id) ids.push(m.id);
      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);
    return ids;
  }

  getSpike(userId: string): SpikeState | null {
    return this.spikes.get(userId) ?? null;
  }

  /** Phase 0: chạy nền, chỉ đọc header (From, Subject). Không đọc, không lưu nội dung. */
  startSpike(userId: string, range: DateRange, window: EmailWindow): SpikeState {
    const current = this.spikes.get(userId);
    if (current?.status === 'RUNNING') return current;
    const state: SpikeState = {
      status: 'RUNNING',
      phase: 'listing',
      listed: 0,
      processed: 0,
      waitingMs: 0,
      startedAt: new Date().toISOString(),
    };
    this.spikes.set(userId, state);
    this.runSpike(userId, range, window, state).catch((e: unknown) => {
      state.status = 'FAILED';
      state.revoked = e instanceof GmailRevokedError;
      state.error = state.revoked
        ? 'Quyền Gmail đã hết hạn. Hãy kết nối lại.'
        : 'Quét thất bại. Thử lại sau ít phút.';
      this.logger.error(`spike failed for user ${userId}: ${(e as Error).message}`);
    });
    return state;
  }

  private async runSpike(userId: string, range: DateRange, window: EmailWindow, state: SpikeState) {
    const client = await this.clientFor(userId);
    const bucket = new TokenBucket(UNITS_PER_SEC);
    const onRetry = (ms: number) => {
      state.waitingMs = ms;
      setTimeout(() => (state.waitingMs = 0), ms);
    };
    const ids = await this.listShopeeMessageIds(client, window, bucket, onRetry);
    state.listed = ids.length;
    state.phase = 'reading';

    const groups = new Map<string, SpikeTemplate>();
    let shopeeSender = 0;
    let ignored = 0;
    await mapLimit(ids, 4, async (id) => {
      await bucket.take(COST_GET);
      const res = await withBackoff(
        () =>
          client.users.messages.get({
            userId: 'me',
            id,
            format: 'metadata',
            metadataHeaders: ['From', 'Subject'],
          }),
        { onRetry },
      );
      state.processed++;
      const headers = res.data.payload?.headers ?? [];
      const from = headers.find((h) => h.name === 'From')?.value ?? '';
      if (!isShopeeSender(from)) return;
      shopeeSender++;
      const rawSubject = headers.find((h) => h.name === 'Subject')?.value ?? '';
      const kind = classifyShopeeSubject(rawSubject);
      if (!kind) {
        ignored++;
        return;
      }
      const subject = subjectTemplate(rawSubject);
      const at = new Date(Number(res.data.internalDate ?? 0)).toISOString();
      const g = groups.get(subject);
      if (!g) groups.set(subject, { kind, subject, count: 1, firstAt: at, lastAt: at });
      else {
        g.count++;
        if (at < g.firstAt) g.firstAt = at;
        if (at > g.lastAt) g.lastAt = at;
      }
    });

    await this.audit.log(userId, 'gmail.spike', {
      from: range.from,
      to: range.to,
      listed: ids.length,
      shopeeSender,
      ignored,
    });
    state.result = {
      range,
      listed: ids.length,
      shopeeSender,
      ignored,
      templates: [...groups.values()].sort((a, b) => b.count - a.count),
    };
    state.phase = 'done';
    state.status = 'DONE';
  }
}

export async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) await fn(items[next++]);
  });
  await Promise.all(workers);
}
