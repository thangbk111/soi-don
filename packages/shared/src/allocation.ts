/**
 * Phân bổ tiền hàng sau giảm của một đơn xuống từng dòng sản phẩm, phục vụ báo cáo danh mục.
 *
 * Email Shopee chỉ có giảm giá cấp đơn (voucher shop, voucher Shopee, Xu…), không có giảm giá
 * từng sản phẩm, và `discountAmount` đã được suy ra = gross + ship − net. Vì vậy số cần phân bổ
 * lấy thẳng từ số thực trả: pool = net − ship. Không trừ thêm discount → không trừ hai lần.
 *
 * - Chia theo tỷ trọng `lineTotal`; phần dư làm tròn trao cho dòng có phần dư lớn nhất
 *   (hòa thì dòng đứng trước) → tổng các dòng luôn bằng đúng số đã phân bổ.
 * - Nếu tổng giá các dòng nhỏ hơn tổng tiền hàng (thiếu giá sản phẩm), chỉ phần tương ứng với
 *   giá đã biết được chia; phần còn lại vào `unallocated`, không chia đều.
 * - Không chia được (không dòng nào có giá, pool âm) → dòng = null, toàn bộ vào `unallocated`.
 */
export interface AllocationInput {
  grossAmount: number;
  shippingFee: number;
  netAmount: number;
  lineTotals: number[];
}

export interface AllocationResult {
  /** Theo đúng thứ tự `lineTotals`; null = không phân bổ được. */
  lines: (number | null)[];
  /** Giá trị đã biết nhưng chưa gán được cho sản phẩm nào. */
  unallocated: number;
}

export function allocateOrder({
  grossAmount,
  shippingFee,
  netAmount,
  lineTotals,
}: AllocationInput): AllocationResult {
  const pool = netAmount - shippingFee;
  const itemsSum = lineTotals.reduce((s, x) => s + Math.max(0, x), 0);
  const none = () => ({ lines: lineTotals.map(() => null), unallocated: pool });

  if (pool < 0) return none();
  if (itemsSum === 0) return pool === 0 ? { lines: lineTotals.map(() => 0), unallocated: 0 } : none();

  // BigInt: pool × lineTotal có thể vượt 2^53.
  const P = BigInt(pool);
  const S = BigInt(itemsSum);
  const base = BigInt(Math.max(grossAmount, itemsSum));
  // Làm tròn half-up phần được phép phân bổ khi thiếu giá một số dòng.
  const allocatable = (2n * P * S + base) / (2n * base);

  const shares = lineTotals.map((x, i) => {
    const num = allocatable * BigInt(Math.max(0, x));
    return { i, floor: num / S, rem: num % S };
  });
  let left = allocatable - shares.reduce((s, x) => s + x.floor, 0n);
  const order = [...shares].sort((a, b) => (a.rem === b.rem ? a.i - b.i : a.rem > b.rem ? -1 : 1));
  for (const s of order) {
    if (left === 0n) break;
    s.floor += 1n;
    left -= 1n;
  }

  return {
    lines: shares.map((s) => Number(s.floor)),
    unallocated: Number(P - allocatable),
  };
}
