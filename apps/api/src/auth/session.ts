export const SESSION_COOKIE = 'sd_session';
export const OAUTH_STATE_COOKIE = 'sd_oauth_state';
export const SESSION_TTL_SECONDS = 7 * 24 * 3600;

export interface SessionPayload {
  sub: string; // userId
}

export function cookieOptions(maxAgeMs: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeMs,
  };
}
