'use client';

import { UNCATEGORIZED } from '@soi-don/shared';
import type { Category, CategorySource } from '@/lib/api';

export const UNCATEGORIZED_LABEL = 'Chưa phân loại';

export const SOURCE_LABEL: Record<CategorySource, string> = {
  MANUAL: 'Bạn đã chọn',
  USER_RULE: 'Theo quy tắc bạn đã ghi nhớ',
  RULE: 'Tự động theo từ khóa',
  AI: 'AI đề xuất',
};

/** Danh mục theo cây: cha rồi đến các con, giữ thứ tự từ API. */
export function categoryTree(categories: Category[]) {
  const roots = categories.filter((c) => !c.parentId);
  return roots.map((root) => ({
    root,
    children: categories.filter((c) => c.parentId === root.id),
  }));
}

/** "Mẹ và bé › Tã và vệ sinh" */
export function categoryLabel(categories: Category[], id: string | null): string {
  if (!id) return UNCATEGORIZED_LABEL;
  const c = categories.find((x) => x.id === id);
  if (!c) return UNCATEGORIZED_LABEL;
  const parent = c.parentId ? categories.find((x) => x.id === c.parentId) : undefined;
  return parent ? `${parent.name} › ${c.name}` : c.name;
}

function Options({ categories }: { categories: Category[] }) {
  return (
    <>
      {categoryTree(categories).map(({ root, children }) => (
        <optgroup key={root.id} label={root.name}>
          <option value={root.id}>{root.name}</option>
          {children.map((c) => (
            <option key={c.id} value={c.id}>
              {root.name} › {c.name}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  );
}

const SELECT =
  'rounded-md border border-stone-300 bg-white px-2 py-1 text-sm dark:border-stone-700 dark:bg-stone-900';

/** Chọn danh mục để gán. Dòng chưa phân loại hiển thị "Chưa phân loại" nhưng không gán lại được giá trị đó. */
export function CategorySelect({
  categories,
  value,
  onChange,
  disabled,
  className = '',
  ariaLabel = 'Danh mục',
}: {
  categories: Category[];
  value: string | null;
  onChange: (categoryId: string) => void;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <select
      aria-label={ariaLabel}
      value={value ?? ''}
      disabled={disabled}
      onChange={(e) => e.target.value && onChange(e.target.value)}
      className={`${SELECT} ${value ? '' : 'text-amber-700 dark:text-amber-400'} ${className}`}
    >
      {!value && (
        <option value="" disabled>
          {UNCATEGORIZED_LABEL}
        </option>
      )}
      <Options categories={categories} />
    </select>
  );
}

/** Bộ lọc: tất cả / chưa phân loại / một danh mục (danh mục cha gồm cả con). */
export function CategoryFilter({
  categories,
  value,
  onChange,
}: {
  categories: Category[];
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  return (
    <select
      aria-label="Lọc theo danh mục"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      className={SELECT}
    >
      <option value="">Tất cả danh mục</option>
      <option value={UNCATEGORIZED}>{UNCATEGORIZED_LABEL}</option>
      <Options categories={categories} />
    </select>
  );
}
