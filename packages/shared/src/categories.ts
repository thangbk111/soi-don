import { normalizeVi } from './text';

export interface DefaultCategory {
  slug: string;
  name: string;
  /** Slug danh mục cha; tối đa hai cấp. */
  parent?: string;
  /**
   * Cụm từ viết CÓ DẤU, khớp nguyên từ trong tên sản phẩm (sau matchText). Giữ dấu vì bỏ dấu
   * làm trùng nghĩa: giấy/giày, đẹp/dép, sạch/sách, trà/(kiểm) tra.
   */
  keywords: string[];
}

/** Slug danh mục người dùng chọn khi sản phẩm không thuộc nhóm nào ("đã xem xét"). */
export const OTHER_CATEGORY_SLUG = 'khac';
/** Giá trị lọc cho dòng chưa có danh mục (categoryId = null). */
export const UNCATEGORIZED = 'uncategorized';

/** Thứ tự trong mảng = thứ tự hiển thị. */
export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { slug: 'me-va-be', name: 'Mẹ và bé', keywords: [] },
  {
    slug: 'me-va-be-ta-ve-sinh',
    name: 'Tã và vệ sinh',
    parent: 'me-va-be',
    keywords: [
      'tã', 'tã dán', 'tã quần', 'bỉm', 'khăn ướt', 'khăn sữa', 'miếng lót sơ sinh',
      'bô vệ sinh', 'bô tập', 'hút mũi',
    ],
  },
  {
    slug: 'me-va-be-sua-an-dam',
    name: 'Sữa và ăn dặm',
    parent: 'me-va-be',
    keywords: [
      'sữa bột', 'sữa công thức', 'sữa pha sẵn', 'abbott grow', 'ăn dặm', 'bột ăn dặm',
      'cháo ăn dặm', 'bình sữa', 'núm ti',
    ],
  },
  {
    slug: 'me-va-be-quan-ao',
    name: 'Quần áo',
    parent: 'me-va-be',
    keywords: [
      'quần áo sơ sinh', 'áo sơ sinh', 'bộ sơ sinh', 'bodysuit', 'body chip', 'body dài tay',
      'body cộc tay', 'quần áo trẻ em', 'yếm ăn',
    ],
  },
  {
    slug: 'me-va-be-do-choi',
    name: 'Đồ chơi',
    keywords: [
      'đồ chơi', 'lego', 'xếp hình', 'lắp ráp', 'bộ lắp ráp', 'gấu bông', 'thú bông',
      'thú nhồi bông', 'búp bê', 'cát động lực', 'hạt sứ', 'trò chơi bận rộn', 'bảng bận rộn',
    ],
    parent: 'me-va-be',
  },
  {
    slug: 'me-va-be-khac',
    name: 'Đồ dùng khác',
    parent: 'me-va-be',
    keywords: [
      'xe đẩy', 'ghế ăn dặm', 'đĩa ăn dặm', 'cho trẻ sơ sinh', 'trẻ sơ sinh', 'ghế ngồi trước xe',
      'đai đi xe máy',
    ],
  },
  {
    slug: 'thuc-pham',
    name: 'Thực phẩm',
    keywords: [
      'bánh', 'kẹo', 'kẹo dẻo', 'trà', 'trà xanh', 'trà sữa', 'trà túi lọc', 'cà phê', 'cafe',
      'coffee', 'specialty coffee', 'snack', 'mì gói', 'mì tôm', 'gạo', 'gạo lứt', 'dầu ăn',
      'nước mắm', 'gia vị', 'bột nêm', 'hạt điều', 'sữa chua', 'sữa tươi', 'ngũ cốc', 'granola',
      'rong biển', 'socola', 'chocolate', 'nước ngọt', 'thịt', 'kem béo', 'whipping cream',
      'siro', 'nước yến', 'mật ong',
    ],
  },
  {
    slug: 'thoi-trang',
    name: 'Thời trang',
    keywords: [
      'áo', 'áo thun', 'áo phông', 'áo khoác', 'áo sơ mi', 'áo sơmi', 'áo polo', 'áo len',
      'áo nỉ', 'áo lót', 'cardigan', 'sweatshirt', 'quần', 'quần jean', 'quần jeans',
      'quần short', 'quần đùi', 'quần tây', 'quần kaki', 'bộ quần áo', 'chân váy', 'váy', 'đầm',
      'đồ bộ', 'bộ đồ', 'set đồ', 'set bộ', 'sét bộ', 'đồ mặc nhà', 'đồ ngủ', 'pijama', 'pyjama',
      'bộ cộc', 'bộ cộc tay', 'bộ dài tay', 'bộ ba lỗ', 'bộ sát nách', 'bộ giữ nhiệt',
      'bộ đi biển', 'cosplay', 'giày', 'dép', 'sandal', 'túi xách', 'balo', 'thắt lưng',
      'ví đựng tiền', 'wallet', 'găng tay', 'kính râm',
    ],
  },
  {
    slug: 'lam-dep',
    name: 'Làm đẹp',
    keywords: [
      'son môi', 'son kem', 'son dưỡng', 'chống nắng', 'kem chống nắng', 'sữa chống nắng',
      'gel chống nắng', 'serum', 'toner', 'sữa rửa mặt', 'tẩy trang', 'micellar', 'mặt nạ',
      'kem dưỡng', 'dưỡng ẩm', 'dưỡng da', 'kem nền', 'kem lót', 'nâng tông', 'kem nâng tông',
      'che khuyết điểm', 'cushion', 'trang điểm', 'bông trang điểm', 'mascara', 'kẻ mắt',
      'bút kẻ mắt', 'nước hoa', 'dầu gội', 'dầu xả', 'gội xả', 'sữa tắm', 'tẩy tế bào chết',
      'retinol', 'chống lão hóa', 'cạo râu', 'máy cạo râu', 'lưỡi dao cạo', 'tỉa lông mày',
      'dao tỉa', 'buộc tóc', 'chun buộc tóc',
    ],
  },
  {
    slug: 'gia-dung',
    name: 'Gia dụng',
    keywords: [
      'nước giặt', 'nước xả vải', 'nước giặt xả', 'nước rửa chén', 'viên rửa chén', 'rửa chén',
      'nước lau sàn', 'giấy vệ sinh', 'khăn giấy', 'khăn lưới', 'giẻ rửa', 'cọ rửa', 'rửa cốc',
      'cây rửa cốc', 'cây lau nhà', 'bông lau', 'nồi', 'nồi cơm', 'nồi chiên', 'bộ nồi', 'chảo',
      'bếp từ', 'bếp điện', 'bếp hồng ngoại', 'dao nhà bếp', 'chày cối', 'cân tiểu ly',
      'cân pha cà phê', 'khay làm đá', 'khuôn làm đá', 'cốc', 'cốc sứ', 'cốc giấy', 'ly giấy',
      'chai thủy tinh', 'hộp đựng', 'hộp cơm', 'túi đựng hộp cơm', 'bình giữ nhiệt',
      'chăn', 'ruột chăn', 'chăn ga', 'gối', 'đệm', 'nệm', 'thảm', 'thảm xốp', 'kệ', 'kệ sách',
      'móc dán', 'móc treo', 'rổ', 'chậu', 'túi rác', 'máy hút bụi', 'máy hút ẩm', 'lọc không khí',
      'màng lọc', 'tấm chắn gió', 'điều hòa', 'đèn led', 'đèn ngủ', 'bóng đèn', 'tấm mica',
      'chân bình', 'mũi khoan', 'ghế camping', 'ghế xếp', 'bàn cắm trại',
      // Dụng cụ pha cà phê: tên thường chứa "cà phê" nhưng không phải thực phẩm.
      'phễu', 'giấy lọc', 'bình pha', 'bình đựng', 'bình cổ ngỗng', 'ấm pha', 'dụng cụ pha',
      'máy xay', 'máy đánh bọt', 'ca đánh sữa', 'vòng đong', 'thẻ tham chiếu',
    ],
  },
  {
    slug: 'dien-tu',
    name: 'Điện tử',
    keywords: [
      'tai nghe', 'củ sạc', 'cáp sạc', 'dây sạc', 'sạc dự phòng', 'sạc nhanh', 'sạc pin',
      'pin cmos', 'ốp lưng', 'ốp điện thoại', 'điện thoại', 'kính cường lực', 'iphone',
      'giá đỡ điện thoại', 'bàn phím', 'chuột', 'chuột không dây', 'lót chuột', 'loa bluetooth',
      'thẻ nhớ', 'usb', 'hdmi', 'hub usb', 'router', 'cáp mạng', 'màn hình', 'laptop',
      'máy tính', 'kệ nâng máy tính', 'ram laptop', 'keo tản nhiệt', 'ổ cắm', 'ổ điện',
      'smartwatch', 'đồng hồ thông minh',
    ],
  },
  {
    slug: 'suc-khoe',
    name: 'Sức khỏe',
    keywords: [
      'vitamin', 'thực phẩm chức năng', 'viên uống', 'viên sủi', 'khẩu trang', 'nhiệt kế',
      'huyết áp', 'omega 3', 'men vi sinh', 'băng dán', 'nước muối sinh lý', 'dầu gió',
      'kem đánh răng', 'bàn chải đánh răng', 'nước súc miệng', 'chỉ nha khoa', 'tăm chỉ nha khoa',
      'máy tăm nước', 'bao cao su', 'xịt muỗi', 'chống muỗi',
    ],
  },
  {
    slug: 'hoc-tap',
    name: 'Học tập',
    keywords: [
      'sách', 'sách giáo khoa', 'sách tham khảo', 'truyện tranh', 'tiểu thuyết', 'ehon',
      'bút bi', 'bút chì', 'sổ tay', 'giấy a4', 'văn phòng phẩm', 'thước kẻ',
    ],
  },
  { slug: OTHER_CATEGORY_SLUG, name: 'Khác', keywords: [] },
];

/** Thời trang có dấu hiệu dành cho trẻ em → Mẹ và bé › Quần áo. */
const KID_CLOTHING_SLUG = 'me-va-be-quan-ao';
const KID_MARKERS = [
  'cho bé', 'bé trai', 'bé gái', 'trẻ em', 'cho trẻ', 'sơ sinh', 'em bé', 'kids', 'baby',
  'tuổi', 'tập đi', 'mẫu giáo',
];

/** Khóa nhận diện sản phẩm khi email không có mã sản phẩm: tên đã bỏ dấu, chỉ giữ chữ-số. */
export function productKey(name: string): string {
  return normalizeVi(name)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Văn bản để dò từ khóa: giữ dấu, chữ thường, chỉ còn chữ-số cách nhau một khoảng trắng.
 * - NFKC: đưa chữ trang trí (𝐂𝐚𝐨 𝐂ấ𝐩) về chữ thường.
 * - Dấu kiểu cũ → kiểu mới ở vần cuối từ: hoà → hòa, khoẻ → khỏe, thuỷ → thủy.
 * - Bỏ các nhãn khuyến mãi đầu tên: [LIVE], (Mùa mới 2026)… vì chúng không nói sản phẩm là gì.
 */
export function matchText(name: string): string {
  return name
    .normalize('NFKC')
    .toLowerCase()
    .replace(/^\s*(?:[[(【][^\])】]*[\])】][\s\-–|:]*)+/u, '')
    .replace(/o([àáảãạ])(?!\p{L})/gu, (_, v: string) => OLD_TONE[v] + 'a')
    .replace(/o([èéẻẽẹ])(?!\p{L})/gu, (_, v: string) => OLD_TONE[v] + 'e')
    .replace(/u([ỳýỷỹỵ])(?!\p{L})/gu, (_, v: string) => OLD_TONE[v] + 'y')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Dấu thanh trên nguyên âm sau → cùng dấu đó trên o / u. */
const OLD_TONE: Record<string, string> = {
  à: 'ò', á: 'ó', ả: 'ỏ', ã: 'õ', ạ: 'ọ',
  è: 'ò', é: 'ó', ẻ: 'ỏ', ẽ: 'õ', ẹ: 'ọ',
  ỳ: 'ù', ý: 'ú', ỷ: 'ủ', ỹ: 'ũ', ỵ: 'ụ',
};

const KEYWORDS = DEFAULT_CATEGORIES.flatMap((c) =>
  c.keywords.map((kw) => ({ slug: c.slug, kw: ` ${matchText(kw)} ` })),
);
const KID_MARKER_TEXT = KID_MARKERS.map((m) => ` ${matchText(m)} `);

/**
 * Quy tắc có sẵn, khớp nguyên cụm từ có dấu:
 * 1. Cụm đứng sớm nhất trong tên thắng: tiếng Việt đặt danh từ chính lên đầu ("Giấy lọc cà phê"
 *    là giấy lọc, không phải cà phê), còn phần sau thường là công dụng / quà tặng kèm.
 * 2. Cùng vị trí → cụm dài hơn thắng ("áo thun" hơn "áo").
 * 3. Cùng vị trí, cùng độ dài nhưng khác danh mục → null thay vì đoán.
 * Không bao giờ trả "Khác": không khớp = chưa đủ căn cứ = Chưa phân loại.
 */
export function matchBuiltinCategory(productName: string): string | null {
  const text = ` ${matchText(productName)} `;
  let best: { slug: string; pos: number; len: number } | null = null;
  let tie = false;
  for (const { slug, kw } of KEYWORDS) {
    const pos = text.indexOf(kw);
    if (pos < 0) continue;
    if (!best || pos < best.pos || (pos === best.pos && kw.length > best.len)) {
      best = { slug, pos, len: kw.length };
      tie = false;
    } else if (pos === best.pos && kw.length === best.len && slug !== best.slug) tie = true;
  }
  if (!best || tie) return null;
  if (best.slug === 'thoi-trang' && KID_MARKER_TEXT.some((m) => text.includes(m)))
    return KID_CLOTHING_SLUG;
  return best.slug;
}
