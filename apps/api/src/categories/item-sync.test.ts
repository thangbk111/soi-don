import { describe, expect, it } from 'vitest';
import { type ExistingItem, planItemSync } from './item-sync';

const old = (id: string, productName: string, over: Partial<ExistingItem> = {}): ExistingItem => ({
  id,
  productName,
  variant: null,
  categoryId: null,
  categorySource: null,
  ...over,
});
const parsed = (name: string, variant?: string) => ({
  name,
  variant,
  quantity: 1,
  unitPrice: 1000,
  lineTotal: 1000,
});

describe('planItemSync (nhập lại email của cùng đơn)', () => {
  it('giữ nguyên id và danh mục đã sửa tay của dòng trùng tên + mẫu mã', () => {
    const plan = planItemSync(
      [
        old('a', 'Áo thun', { variant: 'Đen', categoryId: 'cat-khac', categorySource: 'MANUAL' }),
        old('b', 'Tã dán', { categoryId: 'cat-ta', categorySource: 'RULE' }),
      ],
      [parsed('Tã dán'), parsed('Áo thun', 'Đen')],
    );
    expect(plan.lines).toEqual([
      { existingId: 'b', keepCategory: true },
      { existingId: 'a', keepCategory: true },
    ]);
    expect(plan.deleteIds).toEqual([]);
  });

  it('dòng cũ chưa phân loại → được phân loại lại; dòng mới → tạo mới', () => {
    const plan = planItemSync([old('a', 'Bánh quy')], [parsed('Bánh quy'), parsed('Kẹo dẻo')]);
    expect(plan.lines).toEqual([
      { existingId: 'a', keepCategory: false },
      { existingId: null, keepCategory: false },
    ]);
  });

  it('khác mẫu mã là dòng khác; dòng cũ không còn trong email bị xóa', () => {
    const plan = planItemSync(
      [old('a', 'Áo thun', { variant: 'Đen', categoryId: 'x', categorySource: 'MANUAL' })],
      [parsed('Áo thun', 'Trắng')],
    );
    expect(plan.lines).toEqual([{ existingId: null, keepCategory: false }]);
    expect(plan.deleteIds).toEqual(['a']);
  });

  it('hai dòng trùng tên ghép theo thứ tự xuất hiện', () => {
    const plan = planItemSync(
      [
        old('a', 'Quà tặng', { categoryId: 'x', categorySource: 'MANUAL' }),
        old('b', 'Quà tặng'),
      ],
      [parsed('Quà tặng'), parsed('Quà tặng')],
    );
    expect(plan.lines.map((l) => l.existingId)).toEqual(['a', 'b']);
    expect(plan.lines.map((l) => l.keepCategory)).toEqual([true, false]);
  });
});
