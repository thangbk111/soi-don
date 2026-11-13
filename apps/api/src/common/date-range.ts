import { BadRequestException } from '@nestjs/common';
import { type DateRange, rangeInstants, validateRange } from '@soi-don/shared';

/** Đọc {from, to} (YYYY-MM-DD, giờ VN) từ request; 400 nếu không hợp lệ. */
export function parseRangeOrThrow(input: { from?: unknown; to?: unknown } | undefined) {
  const range = {
    from: typeof input?.from === 'string' ? input.from : undefined,
    to: typeof input?.to === 'string' ? input.to : undefined,
  };
  const error = validateRange(range);
  if (error) throw new BadRequestException(error);
  const valid = range as DateRange;
  return { range: valid, ...rangeInstants(valid) };
}
