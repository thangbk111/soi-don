import { describe, expect, it } from 'vitest';
import { DEFAULT_CATEGORIES, matchBuiltinCategory, matchText, productKey } from './categories';

describe('productKey', () => {
  it('chuẩn hóa tên: bỏ dấu, lowercase, gộp ký tự đặc biệt', () => {
    expect(productKey('  [LS] Nước Giặt ARIEL — Túi 4.1KG ')).toBe('ls nuoc giat ariel tui 4 1kg');
  });
});

describe('DEFAULT_CATEGORIES', () => {
  it('tối đa hai cấp và slug cha tồn tại', () => {
    const slugs = new Set(DEFAULT_CATEGORIES.map((c) => c.slug));
    expect(slugs.size).toBe(DEFAULT_CATEGORIES.length);
    for (const c of DEFAULT_CATEGORIES) {
      if (!c.parent) continue;
      const parent = DEFAULT_CATEGORIES.find((p) => p.slug === c.parent);
      expect(parent).toBeDefined();
      expect(parent?.parent).toBeUndefined();
    }
  });

  it('"Khác" không có từ khóa: chỉ người dùng mới chọn được', () => {
    expect(DEFAULT_CATEGORIES.find((c) => c.slug === 'khac')?.keywords).toEqual([]);
  });
});

describe('matchText', () => {
  it('giữ dấu, bỏ nhãn khuyến mãi đầu tên, đưa chữ trang trí và dấu kiểu cũ về chuẩn', () => {
    expect(matchText('[HB GIFT – Quà tặng không bán] Dầu Gội 50ml')).toBe('dầu gội 50ml');
    expect(matchText('(Mùa mới 2026) [LIVE] Cà Phê Rang')).toBe('cà phê rang');
    expect(matchText('[𝐂𝐚𝐨 𝐂ấ𝐩] Đầm Ren')).toBe('đầm ren');
    expect(matchText('Tấm chắn gió điều hoà, sức khoẻ, thuỷ tinh')).toBe(
      'tấm chắn gió điều hòa sức khỏe thủy tinh',
    );
  });
});

describe('DEFAULT_CATEGORIES keywords', () => {
  it('không có từ khóa trùng giữa hai danh mục', () => {
    const seen = new Map<string, string>();
    for (const c of DEFAULT_CATEGORIES)
      for (const kw of c.keywords) {
        const k = matchText(kw);
        expect(seen.get(k) ?? c.slug, `"${kw}"`).toBe(c.slug);
        seen.set(k, c.slug);
      }
  });
});

describe('matchBuiltinCategory', () => {
  it.each([
    ['Nước tẩy trang làm sạch sâu cho da nhạy cảm Micellar Water 400ml', 'lam-dep'],
    ['Sữa rửa mặt làm sạch da SA Smoothing Cleanser 473ML', 'lam-dep'],
    ['[LS] Nước Giặt Chuyên Gia Cửa Trên Ngăn Lem Màu Túi 4.1KG', 'gia-dung'],
    ['Tã dán siêu thấm size M 76 miếng', 'me-va-be-ta-ve-sinh'],
    ['Sữa bột số 0 800g', 'me-va-be-sua-an-dam'],
    ['Tai nghe bluetooth không dây', 'dien-tu'],
    ['Giấy vệ sinh 10 cuộn', 'gia-dung'],
    ['Thùng 48 hộp sữa nước Abbott Grow Gold 110ml', 'me-va-be-sua-an-dam'],
    ['Sách - Combo 10 quyển Ehon cho bé 0-6 tuổi', 'hoc-tap'],
    ['Pharmacity Bao cao su siêu mỏng (10 cái/hộp)', 'suc-khoe'],
    ['Bộ 3 Kem đánh răng cho trẻ 6-8 tuổi', 'suc-khoe'],
  ])('%s → %s', (name, slug) => {
    expect(matchBuiltinCategory(name)).toBe(slug);
  });

  it('giữ dấu: giấy ≠ giày, đẹp ≠ dép, sạch ≠ sách, kiểm tra ≠ trà', () => {
    expect(matchBuiltinCategory('50 cốc giấy dùng 1 lần')).toBe('gia-dung');
    expect(matchBuiltinCategory('Set bao lì xì giấy C150 màu in sắc nét')).toBeNull();
    expect(matchBuiltinCategory('Kệ gỗ gắn tường đẹp')).toBe('gia-dung');
    expect(matchBuiltinCategory('Bao lì xì loại đẹp')).toBeNull();
    expect(matchBuiltinCategory('Que kiểm tra')).toBeNull();
    expect(matchBuiltinCategory('Giày thể thao nam')).toBe('thoi-trang');
  });

  it('cụm đứng đầu tên thắng: dụng cụ pha cà phê là gia dụng, cà phê là thực phẩm', () => {
    expect(matchBuiltinCategory('Giấy lọc cà phê V60 100 tờ')).toBe('gia-dung');
    expect(matchBuiltinCategory('Máy xay cà phê cầm tay lưỡi thép')).toBe('gia-dung');
    expect(matchBuiltinCategory('Cà phê Arabica Cầu Đất rang xay 250gr')).toBe('thuc-pham');
    expect(matchBuiltinCategory('Đầu chuyển đổi USB sang Type C có dây gắn móc treo')).toBe('dien-tu');
    expect(matchBuiltinCategory('Nước giặt quần áo cho bé 3 lít')).toBe('gia-dung');
    expect(matchBuiltinCategory('[LIVE DAILY] Hộp 10 miếng Mặt nạ giấy Vitamin B5')).toBe('lam-dep');
  });

  it('cùng vị trí → cụm dài hơn thắng', () => {
    expect(matchBuiltinCategory('Kệ nâng máy tính bằng nhôm')).toBe('dien-tu');
    expect(matchBuiltinCategory('Kệ sách gỗ đa tầng')).toBe('gia-dung');
  });

  it('quần áo có dấu hiệu trẻ em → Mẹ và bé › Quần áo', () => {
    expect(matchBuiltinCategory('Bộ cộc tay cotton cho bé trai 8-18kg')).toBe('me-va-be-quan-ao');
    expect(matchBuiltinCategory('Áo nỉ dài tay cho bé đi chơi tết')).toBe('me-va-be-quan-ao');
    expect(matchBuiltinCategory('Áo thun nam cotton 220gsm')).toBe('thoi-trang');
  });

  it('không đủ căn cứ → null (Chưa phân loại), không bao giờ tự gán "Khác"', () => {
    expect(matchBuiltinCategory('Combo quà tặng đặc biệt')).toBeNull();
    expect(matchBuiltinCategory('Túi quà bí mật ngẫu nhiên')).toBeNull();
  });
});
