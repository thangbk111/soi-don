/** "₫1.234.567" | "1.234.567đ" | "1,234,567" → 1234567. Trả null nếu không có chữ số. */
export function parseVnd(input: string): number | null {
  const digits = input.replace(/[^\d]/g, '');
  if (digits === '') return null;
  const n = Number(digits);
  return Number.isSafeInteger(n) ? n : null;
}

/** 1234000 → "1.234.000đ" */
export function formatVnd(amount: number): string {
  return `${new Intl.NumberFormat('vi-VN').format(amount)}đ`;
}

/** 38600000 → "38,6 triệu"; dưới 1 triệu thì dùng formatVnd. */
export function formatVndCompact(amount: number): string {
  if (Math.abs(amount) >= 1_000_000_000) {
    return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(amount / 1_000_000_000)} tỷ`;
  }
  if (Math.abs(amount) >= 1_000_000) {
    return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(amount / 1_000_000)} triệu`;
  }
  return formatVnd(amount);
}
