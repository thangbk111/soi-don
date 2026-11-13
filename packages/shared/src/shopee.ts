import { normalizeVi } from './text';

/** Các loại email Shopee liên quan tới đơn hàng. Mọi email khác (quảng cáo, Affiliate, cảnh báo đăng nhập) bị bỏ qua. */
export type OrderEmailKind =
  | 'ORDER_DELIVERED'
  | 'PAYMENT_CONFIRMED'
  | 'RETURN_REQUESTED'
  | 'RETURN_ACCEPTED'
  | 'RETURN_SHIPPING'
  | 'RETURN_RESULT';

export const ORDER_EMAIL_KIND_LABEL: Record<OrderEmailKind, string> = {
  ORDER_DELIVERED: 'Giao hàng thành công',
  PAYMENT_CONFIRMED: 'Thanh toán thành công',
  RETURN_REQUESTED: 'Yêu cầu trả hàng/hoàn tiền',
  RETURN_ACCEPTED: 'Trả hàng được chấp nhận',
  RETURN_SHIPPING: 'Vận chuyển hàng trả',
  RETURN_RESULT: 'Kết quả trả hàng/hoàn tiền',
};

// Kiểm tra theo thứ tự: nhóm trả hàng trước vì tiêu đề của chúng cũng có thể chứa "thành công".
const RULES: [OrderEmailKind, RegExp][] = [
  ['RETURN_RESULT', /ket qua xu ly yeu cau tra hang/],
  ['RETURN_SHIPPING', /xac nhan hinh thuc van chuyen cho yeu cau tra hang/],
  ['RETURN_ACCEPTED', /yeu cau tra hang.* duoc chap nhan/],
  ['RETURN_REQUESTED', /yeu cau tra hang.* da duoc tiep nhan/],
  ['ORDER_DELIVERED', /^don hang \S+ da giao hang thanh cong/],
  ['PAYMENT_CONFIRMED', /^xac nhan thanh toan thanh cong/],
];

export function classifyShopeeSubject(subject: string): OrderEmailKind | null {
  const s = normalizeVi(subject).replace(/\s+/g, ' ');
  for (const [kind, re] of RULES) if (re.test(s)) return kind;
  return null;
}

/** Lọc phía Gmail để không phải đọc email quảng cáo. Vẫn phải classify lại phía mình. */
export const SHOPEE_ORDER_SUBJECT_QUERY =
  'subject:("giao hàng thành công" OR "thanh toán thành công" OR "trả hàng" OR "hoàn tiền")';
