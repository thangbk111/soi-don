import {
  BadRequestException,
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
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { AuthGuard, UserId } from './auth.guard';
import {
  cookieOptions,
  OAUTH_STATE_COOKIE,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  SessionPayload,
} from './session';

@Controller()
export class AuthController {
  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private client() {
    return new OAuth2Client(
      this.config.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      this.config.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
      this.config.getOrThrow<string>('GOOGLE_REDIRECT_URI'),
    );
  }

  @Get('auth/google')
  start(@Res() res: Response) {
    const state = randomBytes(16).toString('hex');
    res.cookie(OAUTH_STATE_COOKIE, state, cookieOptions(10 * 60 * 1000));
    const url = this.client().generateAuthUrl({
      scope: ['openid', 'email', 'profile'],
      state,
      prompt: 'select_account',
    });
    res.redirect(url);
  }

  @Get('auth/google/callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const web = this.config.getOrThrow<string>('WEB_ORIGIN');
    if (error) return res.redirect(`${web}/?error=${encodeURIComponent(error)}`);
    if (!code || !state || state !== req.cookies?.[OAUTH_STATE_COOKIE]) {
      throw new BadRequestException('Invalid OAuth state');
    }
    res.clearCookie(OAUTH_STATE_COOKIE, { path: '/' });

    const client = this.client();
    const { tokens } = await client.getToken(code);
    if (!tokens.id_token) throw new BadRequestException('Missing id_token');
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: this.config.getOrThrow<string>('GOOGLE_CLIENT_ID'),
    });
    const p = ticket.getPayload();
    if (!p?.sub || !p.email || !p.email_verified)
      throw new BadRequestException('Email not verified');

    const user = await this.prisma.user.upsert({
      where: { googleSub: p.sub },
      update: { email: p.email, displayName: p.name ?? null, deletedAt: null },
      create: { googleSub: p.sub, email: p.email, displayName: p.name ?? null },
    });
    await this.audit.log(user.id, 'auth.login');

    const payload: SessionPayload = { sub: user.id };
    const token = jwt.sign(payload, this.config.getOrThrow<string>('JWT_SECRET'), {
      expiresIn: SESSION_TTL_SECONDS,
    });
    res.cookie(SESSION_COOKIE, token, cookieOptions(SESSION_TTL_SECONDS * 1000));

    const conn = await this.prisma.emailConnection.findUnique({
      where: { userId_provider: { userId: user.id, provider: 'gmail' } },
    });
    res.redirect(`${web}${conn?.status === 'ACTIVE' ? '/dashboard' : '/onboarding'}`);
  }

  @Post('auth/logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async me(@UserId() userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        connections: {
          select: { provider: true, status: true, lastSyncedAt: true, createdAt: true },
        },
      },
    });
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      gmail: user.connections.find((c) => c.provider === 'gmail') ?? null,
    };
  }
}
