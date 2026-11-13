import type { EmailInput, EmailParser, ParsedOrderEvent } from '@soi-don/shared';
import { shopeeDeliveredParser, shopeePaymentParser, shopeeReturnParser } from './shopee.parsers';

export const PARSERS: EmailParser[] = [
  shopeeDeliveredParser,
  shopeePaymentParser,
  shopeeReturnParser,
];

/** Đổi khi sửa parser → các email đã xử lý bằng phiên bản cũ sẽ được parse lại. */
export const PARSER_SET_VERSION = PARSERS.map((p) => `${p.id}@${p.version}`).join(',');

export interface RegistryResult {
  parser: EmailParser;
  events: ParsedOrderEvent[];
}

export function parseEmail(input: EmailInput): RegistryResult | null {
  const parser = PARSERS.find((p) => p.canParse(input));
  if (!parser) return null;
  return { parser, events: parser.parse(input) };
}
