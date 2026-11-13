import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { randomBytes } from 'node:crypto';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { parseRangeOrThrow } from '../common/date-range';
import { cookieOptions, OAUTH_STATE_COOKIE } from '../auth/session';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { GmailService } from './gmail.service';

@Controller('gmail')
@UseGuards(AuthGuard)
export class GmailController {
  constructor(
    private readonly gmail: GmailService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Get('connect')
  async connect(@UserId() userId: string, @Res() res: Response) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const state = randomBytes(16).toString('hex');
    res.cookie(OAUTH_STATE_COOKIE, state, cookieOptions(10 * 60 * 1000));
    res.redirect(this.gmail.connectUrl(state, user.email));
  }

  @Get('callback')
  async callback(
    @UserId() userId: string,
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const web = this.config.getOrThrow<string>('WEB_ORIGIN');
    if (error) return res.redirect(`${web}/onboarding?error=${encodeURIComponent(error)}`);
    if (!code || !state || state !== req.cookies?.[OAUTH_STATE_COOKIE]) {
      throw new BadRequestException('Invalid OAuth state');
    }
    res.clearCookie(OAUTH_STATE_COOKIE, { path: '/' });
    try {
      await this.gmail.handleCallback(userId, code);
    } catch (e) {
      const msg = e instanceof BadRequestException ? e.message : 'connect_failed';
      return res.redirect(`${web}/onboarding?error=${encodeURIComponent(msg)}`);
    }
    res.redirect(`${web}/onboarding?connected=1`);
  }

  @Post('disconnect')
  async disconnect(@UserId() userId: string) {
    await this.gmail.disconnect(userId);
    return { ok: true };
  }

  @Post('spike')
  startSpike(@UserId() userId: string, @Body() body: { from?: unknown; to?: unknown }) {
    // Quét thử đếm email theo ngày nhận, nên dùng đúng khoảng đã chọn.
    const { range, start, endExclusive } = parseRangeOrThrow(body);
    return this.gmail.startSpike(userId, range, { after: start, before: endExclusive });
  }

  @Get('spike')
  getSpike(@UserId() userId: string) {
    return this.gmail.getSpike(userId);
  }
}
