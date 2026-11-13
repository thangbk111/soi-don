import { normalizeVi, parseVnd, type ParsedItem } from '@soi-don/shared';
import { parseViDateTime } from './datetime';

/** Một đơn trong phần "THÔNG TIN ĐƠN HÀNG" của email Shopee. */
export interface OrderBlock {
  orderId?: string;
  orderDate?: Date;
  shopName?: string;
  items: ParsedItem[];
  subtotal?: number;
  listedDiscounts: number[];
  shippingFee?: number;
  netAmount?: number;
  /** Nhãn có giá trị tiền mà parser chưa biết (đã normalize, không chứa PII). */
  unknownMoneyLabels: string[];
}

export interface OrderSection {
  blocks: OrderBlock[];
  /** "Số tiền thanh toán" của email thanh toán (tổng mọi đơn). */
  paymentTotal?: number;
}

/** Các tiêu đề kết thúc phần thông tin đơn hàng. Phần nhận hàng chứa PII nên không bao giờ được đọc. */
const SECTION_END = ['thong tin nhan hang', 'buoc tiep theo'];
const ORDER_ID_RE = /^#?([0-9]{6}[0-9A-Z]{8})$/;
const ITEM_RE = /^(\d+)\.\s+(.+)$/;

const isLabel = (line: string) => line.endsWith(':');
const norm = (line: string) => normalizeVi(line).replace(/\s+/g, ' ').replace(/:$/, '').trim();
const isDiscountLabel = (label: string) =>
  /^(voucher|giam gia|xu|shopee xu|ma giam gia)/.test(label);

export function parseOrderSection(lines: string[]): OrderSection {
  const start = lines.findIndex((l) => norm(l).startsWith('thong tin don hang'));
  if (start < 0) return { blocks: [] };

  const blocks: OrderBlock[] = [];
  let block: OrderBlock | undefined;
  let item: ParsedItem | undefined;
  let i = start + 1;

  const valueAt = (idx: number) => {
    const next = lines[idx + 1];
    return next !== undefined && !isLabel(next) && !ITEM_RE.test(next) ? next : '';
  };

  for (; i < lines.length; i++) {
    const line = lines[i];
    const n = norm(line);
    if (SECTION_END.some((e) => n.startsWith(e))) break;

    const itemMatch = ITEM_RE.exec(line);
    if (itemMatch && block) {
      item = { name: itemMatch[2].trim(), quantity: 1, unitPrice: 0, lineTotal: 0 };
      block.items.push(item);
      continue;
    }
    if (!isLabel(line)) continue;

    const value = valueAt(i);
    if (value) i++; // bỏ qua dòng giá trị vừa đọc

    if (n === 'ma don hang') {
      block = { items: [], listedDiscounts: [], unknownMoneyLabels: [] };
      item = undefined;
      blocks.push(block);
      const m = ORDER_ID_RE.exec(value.replace(/\s/g, ''));
      if (m) block.orderId = m[1];
      continue;
    }
    if (!block) continue;

    switch (n) {
      case 'ngay dat hang':
        block.orderDate = parseViDateTime(value);
        break;
      case 'nguoi ban':
        block.shopName = value || undefined;
        break;
      case 'mau ma':
        if (item && value) item.variant = value;
        break;
      case 'so luong':
        if (item) item.quantity = Number(value.replace(/\D/g, '')) || 1;
        break;
      case 'gia':
        if (item) item.unitPrice = parseVnd(value) ?? 0;
        break;
      case 'tong tien':
        item = undefined; // hết danh sách sản phẩm của đơn
        block.subtotal = parseVnd(value) ?? undefined;
        break;
      case 'phi van chuyen':
        block.shippingFee = parseVnd(value) ?? undefined;
        break;
      case 'tong thanh toan':
        block.netAmount = parseVnd(value) ?? undefined;
        break;
      default: {
        if (!value.includes('₫')) break; // vd "Mã giảm giá của Shopee: SVIP..." là mã, không phải tiền
        const amount = parseVnd(value) ?? 0;
        if (isDiscountLabel(n)) block.listedDiscounts.push(amount);
        else block.unknownMoneyLabels.push(n);
      }
    }
  }

  for (const b of blocks) for (const it of b.items) it.lineTotal = it.unitPrice * it.quantity;

  // "Số tiền thanh toán" nằm trong phần THÔNG TIN THANH TOÁN, sau phần nhận hàng.
  let paymentTotal: number | undefined;
  const payIdx = lines.findIndex((l, idx) => idx > i && norm(l) === 'so tien thanh toan');
  if (payIdx >= 0) paymentTotal = parseVnd(lines[payIdx + 1] ?? '') ?? undefined;

  return { blocks, paymentTotal };
}
