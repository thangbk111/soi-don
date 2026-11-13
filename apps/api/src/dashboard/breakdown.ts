/**
 * Chia tiền hàng sau giảm (đã phân bổ xuống dòng) theo danh mục cấp 1, có chi tiết danh mục con.
 *
 * Với mỗi đơn được tính: Σ allocatedAmount + unallocatedAmount + shippingFee = netAmount
 * (xem allocateOrder). `unallocatedAmount` âm khi phí ship lớn hơn số thực trả (giảm phí ship
 * vượt tiền hàng) → đưa vào "khoản điều chỉnh", không trừ vào danh mục nào.
 */

export interface BreakdownCategory {
  id: string;
  name: string;
  parentId: string | null;
}

export interface BreakdownTx {
  shippingFee: number;
  netAmount: number;
  unallocatedAmount: number;
  items: { categoryId: string | null; allocatedAmount: number | null }[];
}

export interface CategoryAmount {
  /** null = Chưa phân loại */
  id: string | null;
  name: string;
  amount: number;
  /** Số dòng sản phẩm (không phải số lượng đơn vị). */
  lines: number;
  /** Dòng không có giá trị phân bổ (thiếu giá) → không cộng vào amount. */
  linesWithoutValue: number;
}

export interface CategoryBreakdown {
  /** Giảm dần theo amount. */
  groups: (CategoryAmount & { children: CategoryAmount[] })[];
  /** Giá trị đã biết nhưng chưa gán được cho sản phẩm nào. */
  unallocated: number;
  /** Khoản điều chỉnh cấp đơn (≤ 0), không thuộc danh mục nào. */
  adjustment: number;
  shipping: number;
  /** Σ groups + unallocated: cơ sở tính tỷ trọng. */
  allocatedBase: number;
  linesWithoutValue: number;
}

export const UNCATEGORIZED_NAME = 'Chưa phân loại';

const byAmount = (a: CategoryAmount, b: CategoryAmount) =>
  b.amount - a.amount || b.lines - a.lines || a.name.localeCompare(b.name, 'vi');

export function categoryBreakdown(
  counted: BreakdownTx[],
  categories: BreakdownCategory[],
): CategoryBreakdown {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const empty = (id: string | null, name: string): CategoryAmount => ({
    id,
    name,
    amount: 0,
    lines: 0,
    linesWithoutValue: 0,
  });
  const roots = new Map<
    string | null,
    CategoryAmount & { children: Map<string, CategoryAmount> }
  >();
  let unallocated = 0;
  let adjustment = 0;
  let shipping = 0;
  let linesWithoutValue = 0;

  const add = (row: CategoryAmount, value: number | null) => {
    row.lines++;
    if (value === null) row.linesWithoutValue++;
    else row.amount += value;
  };

  for (const t of counted) {
    shipping += t.shippingFee;
    if (t.unallocatedAmount >= 0) unallocated += t.unallocatedAmount;
    else adjustment += t.unallocatedAmount;
    for (const it of t.items) {
      if (it.allocatedAmount === null) linesWithoutValue++;
      const cat = it.categoryId ? byId.get(it.categoryId) : undefined;
      const root = cat?.parentId ? byId.get(cat.parentId) : cat;
      const rootId = root?.id ?? null;
      let group = roots.get(rootId);
      if (!group) {
        group = { ...empty(rootId, root?.name ?? UNCATEGORIZED_NAME), children: new Map() };
        roots.set(rootId, group);
      }
      add(group, it.allocatedAmount);
      if (cat && root && cat.id !== root.id) {
        let child = group.children.get(cat.id);
        if (!child) group.children.set(cat.id, (child = empty(cat.id, cat.name)));
        add(child, it.allocatedAmount);
      }
    }
  }

  const groups = [...roots.values()]
    .map(({ children, ...g }) => ({ ...g, children: [...children.values()].sort(byAmount) }))
    .sort(byAmount);
  return {
    groups,
    unallocated,
    adjustment,
    shipping,
    allocatedBase: groups.reduce((s, g) => s + g.amount, 0) + unallocated,
    linesWithoutValue,
  };
}
