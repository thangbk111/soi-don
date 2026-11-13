import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decrypt, encrypt } from './crypto.service';

describe('crypto', () => {
  const key = randomBytes(32);

  it('round-trips', () => {
    const enc = encrypt('1//refresh-token', key);
    expect(enc).not.toContain('refresh');
    expect(decrypt(enc, key)).toBe('1//refresh-token');
  });

  it('uses a random IV', () => {
    expect(encrypt('x', key)).not.toBe(encrypt('x', key));
  });

  it('rejects tampered ciphertext', () => {
    const buf = Buffer.from(encrypt('secret', key), 'base64');
    buf[buf.length - 1] ^= 1;
    expect(() => decrypt(buf.toString('base64'), key)).toThrow();
  });

  it('rejects the wrong key', () => {
    expect(() => decrypt(encrypt('secret', key), randomBytes(32))).toThrow();
  });
});
