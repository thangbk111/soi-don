import {
  classifyShopeeSubject,
  normalizeVi,
  parseVnd,
  type EmailInput,
  type EmailParser,
  type OrderEmailKind,
  type ParsedOrderEvent,
} from '@soi-don/shared';
import { isShopeeSender } from '../gmail/gmail.constants';
import { parseViDateTime } from './datetime';
import { htmlToLines } from './lines';
import { type OrderBlock, parseOrderSection } from './order-blocks';

/** Lệch quá ngưỡng này (đồng) thì coi là không khớp. */
const TOLERANCE = 1_000;
export const REVIEW_THRESHOLD = 0.8;

function canParseKind(input: EmailInput, kinds: OrderEmailKind[]) {
  const kind = classifyShopeeSubject(input.subject);
  return isShopeeSender(input.from) && kind !== null && kinds.includes(kind);
}

/** Chuyển một block đơn hàng thành event, chấm confidence và gắn cảnh báo. */
export function blockToEvent(
  block: OrderBlock,
  base: Pick<ParsedOrderEvent, 'templateId' | 'eventType' | 'occurredAt'>,
): ParsedOrderEvent {
  const warnings: string[] = [];
  let confidence = 1;

  const ship = block.shippingFee ?? 0;
  const itemsSum = block.items.reduce((s, it) => s + it.lineTotal, 0);
  const gross = block.subtotal ?? (block.items.length ? itemsSum : undefined);
  const net = block.netAmount;
  const listed = block.listedDiscounts.reduce((s, d) => s + d, 0);

  if (!block.orderId) {
    warnings.push('missing_order_id');
    confidence = Math.min(confidence, 0.3);
  }
  if (net === undefined) {
    warnings.push('missing_net_amount');
    confidence = Math.min(confidence, 0.3);
  }
  if (!block.items.length) {
    warnings.push('missing_items');
    confidence -= 0.3;
  } else if (block.subtotal !== undefined && Math.abs(itemsSum - block.subtotal) > TOLERANCE) {
    warnings.push('items_sum_mismatch');
    confidence -= 0.3;
  }

  let discount: number | undefined;
  if (gross !== undefined && net !== undefined) {
    discount = gross + ship - net;
    if (discount < -TOLERANCE) {
      warnings.push('net_exceeds_gross');
      confidence -= 0.4;
    } else if (discount - listed > TOLERANCE) {
      // Thường là Shopee Xu / ưu đãi thanh toán không được liệt kê. Không trừ điểm.
      warnings.push('unlisted_discount');
    }
    discount = Math.max(0, discount);
  }
  for (const label of block.unknownMoneyLabels) warnings.push(`unknown_money_label:${label}`);

  return {
    platform: 'SHOPEE',
    ...base,
    orderId: block.orderId,
    orderDate: block.orderDate,
    shopName: block.shopName,
    items: block.items,
    grossAmount: gross,
    discountAmount: discount,
    listedDiscountAmount: listed,
    shippingFee: block.shippingFee,
    netAmount: net,
    confidence: Math.max(0, Math.round(confidence * 100) / 100),
    warnings,
  };
}

export const shopeeDeliveredParser: EmailParser = {
  id: 'shopee.order_delivered.v1',
  version: '1',
  canParse: (input) => canParseKind(input, ['ORDER_DELIVERED']),
  parse(input) {
    const lines = htmlToLines(input.html);
    const { blocks } = parseOrderSection(lines);
    // "Đơn hàng của bạn đã được giao thành công ngày 20/10/2026."
    const deliveredLine = lines.find((l) => /giao thanh cong ngay/.test(normalizeVi(l)));
    const deliveredAt = (deliveredLine && parseViDateTime(deliveredLine)) || input.receivedAt;
    const events = blocks.map((b) =>
      blockToEvent(b, {
        templateId: this.id,
        eventType: 'ORDER_DELIVERED',
        occurredAt: deliveredAt,
      }),
    );
    // Mã đơn trên tiêu đề phải khớp mã đơn trong nội dung.
    const subjectId = /#?([0-9]{6}[0-9A-Z]{8})\b/.exec(input.subject)?.[1];
    for (const e of events) {
      if (subjectId && e.orderId && e.orderId !== subjectId) {
        e.warnings.push('subject_order_id_mismatch');
        e.confidence = Math.min(e.confidence, 0.5);
      }
    }
    return events;
  },
};

export const shopeePaymentParser: EmailParser = {
  id: 'shopee.payment_confirmed.v1',
  version: '1',
  canParse: (input) => canParseKind(input, ['PAYMENT_CONFIRMED']),
  parse(input) {
    const lines = htmlToLines(input.html);
    const { blocks, paymentTotal } = parseOrderSection(lines);
    const paidLineIdx = lines.findIndex(
      (l) => normalizeVi(l).replace(/:$/, '') === 'ngay thanh toan',
    );
    const paidAt =
      (paidLineIdx >= 0 && parseViDateTime(lines[paidLineIdx + 1] ?? '')) || input.receivedAt;
    const events = blocks.map((b) =>
      blockToEvent(b, { templateId: this.id, eventType: 'ORDER_PLACED', occurredAt: paidAt }),
    );
    // Kiểm tra chéo: tổng các đơn phải bằng "Số tiền thanh toán".
    if (paymentTotal !== undefined && events.length) {
      const sum = events.reduce((s, e) => s + (e.netAmount ?? 0), 0);
      if (Math.abs(sum - paymentTotal) > TOLERANCE) {
        for (const e of events) {
          e.warnings.push('payment_total_mismatch');
          e.confidence = Math.max(0, Math.round((e.confidence - 0.3) * 100) / 100);
        }
      }
    }
    return events;
  },
};

/**
 * Email trả hàng chỉ có một mã 15 ký tự (khác mã đơn 14 ký tự) và không có số tiền,
 * trừ email "Kết quả xử lý" (chưa có mẫu, parse best-effort).
 */
export const shopeeReturnParser: EmailParser = {
  id: 'shopee.return.v0',
  version: '0',
  canParse: (input) =>
    canParseKind(input, [
      'RETURN_REQUESTED',
      'RETURN_ACCEPTED',
      'RETURN_SHIPPING',
      'RETURN_RESULT',
    ]),
  parse(input) {
    const kind = classifyShopeeSubject(input.subject);
    const lines = htmlToLines(input.html);
    const ref =
      /#?\s*([0-9]{6}[0-9A-Z]{8,10})\b/.exec(input.subject)?.[1] ??
      lines.map((l) => l.replace(/^#/, '')).find((l) => /^[0-9]{6}[0-9A-Z]{8,10}$/.test(l));
    const isOrderId = ref !== undefined && ref.length === 14;

    let refundAmount: number | undefined;
    if (kind === 'RETURN_RESULT') {
      const idx = lines.findIndex(
        (l) => /hoan tien|so tien hoan/.test(normalizeVi(l)) && /:$/.test(l),
      );
      if (idx >= 0) refundAmount = parseVnd(lines[idx + 1] ?? '') ?? undefined;
    }

    const warnings = [isOrderId ? 'ref_is_order_id' : 'ref_not_order_id'];
    if (kind === 'RETURN_RESULT' && refundAmount === undefined)
      warnings.push('missing_refund_amount');
    return [
      {
        platform: 'SHOPEE',
        templateId: this.id,
        eventType: refundAmount !== undefined ? 'REFUND' : 'RETURN_REQUESTED',
        occurredAt: input.receivedAt,
        orderId: isOrderId ? ref : undefined,
        externalRef: isOrderId ? undefined : ref,
        items: [],
        refundAmount,
        confidence: 0.5,
        warnings,
      },
    ];
  },
};
