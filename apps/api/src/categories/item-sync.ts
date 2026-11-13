import type { CategorySource } from '@soi-don/db';
import type { ParsedItem } from '@soi-don/shared';

export interface ExistingItem {
  id: string;
  productName: string;
  variant: string | null;
  categoryId: string | null;
  categorySource: CategorySource | null;
}

export interface ItemSyncPlan {
  /** Cùng thứ tự với danh sách sản phẩm trong email. */
  lines: { existingId: string | null; keepCategory: boolean }[];
  deleteIds: string[];
}

const keyOf = (name: string, variant: string | null | undefined) => `${name}\u0000${variant ?? ''}`;

/**
 * Ghép sản phẩm trong email mới với dòng đã lưu của cùng đơn (cùng tên + mẫu mã, theo thứ tự)
 * để giữ id và danh mục. Dòng đã có danh mục giữ nguyên, kể cả khi quy tắc đã đổi/xóa:
 * nhập lại không bao giờ ghi đè phân loại đã lưu.
 */
export function planItemSync(existing: ExistingItem[], items: ParsedItem[]): ItemSyncPlan {
  const pool = new Map<string, ExistingItem[]>();
  for (const e of existing) {
    const k = keyOf(e.productName, e.variant);
    pool.set(k, [...(pool.get(k) ?? []), e]);
  }
  const lines = items.map((it) => {
    const match = pool.get(keyOf(it.name, it.variant))?.shift();
    return { existingId: match?.id ?? null, keepCategory: match?.categoryId != null };
  });
  const deleteIds = [...pool.values()].flat().map((e) => e.id);
  return { lines, deleteIds };
}
