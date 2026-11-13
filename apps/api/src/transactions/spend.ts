import type { TxStatus } from '@soi-don/db';

/**
 * Quy tắc tính chi tiêu dùng chung cho trang Đơn hàng và trang Tổng quan.
 * Đơn chỉ có email thanh toán (chưa giao) vẫn là tiền đã trả; đơn hủy không tính.
 */
export const SPEND_STATUSES: TxStatus[] = ['COMPLETED', 'PENDING', 'PARTIALLY_REFUNDED', 'REFUNDED'];

export const isCounted = (status: TxStatus) => SPEND_STATUSES.includes(status);

type MoneyFields = {
  grossAmount: number;
  discountAmount: number;
  shippingFee: number;
  netAmount: number;
  refundAmount: number;
};

export interface SpendTotals {
  orders: number;
  gross: number;
  discount: number;
  shipping: number;
  /** Tổng thực trả */
  net: number;
  refund: number;
}

/** `counted` phải là các đơn đã lọc theo SPEND_STATUSES. */
export function spendTotals(counted: MoneyFields[]): SpendTotals {
  const sum = (k: keyof MoneyFields) => counted.reduce((s, t) => s + t[k], 0);
  return {
    orders: counted.length,
    gross: sum('grossAmount'),
    discount: sum('discountAmount'),
    shipping: sum('shippingFee'),
    net: sum('netAmount'),
    refund: sum('refundAmount'),
  };
}
