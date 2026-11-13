import { describe, expect, it } from 'vitest';
import { formatVnd, formatVndCompact, parseVnd } from './money';
import { normalizeVi } from './text';

describe('parseVnd', () => {
  it('parses common formats', () => {
    expect(parseVnd('₫1.234.567')).toBe(1234567);
    expect(parseVnd('1.234.567đ')).toBe(1234567);
    expect(parseVnd('abc')).toBeNull();
  });
});

describe('format', () => {
  it('formats VND', () => {
    expect(formatVnd(1234000)).toBe('1.234.000đ');
    expect(formatVndCompact(38_600_000)).toBe('38,6 triệu');
  });
});

describe('normalizeVi', () => {
  it('strips diacritics', () => {
    expect(normalizeVi('Kem Chống Nắng Đẹp')).toBe('kem chong nang dep');
  });
});
