import { describe, expect, it } from 'vitest';
import { classifyShopeeSubject } from './shopee';

// Tiêu đề thật lấy từ kết quả Phase 0 (đã thay mã đơn).
describe('classifyShopeeSubject', () => {
  it.each([
    ['Đơn hàng #251112ABCD1234 đã giao hàng thành công', 'ORDER_DELIVERED'],
    ['Đơn hàng 251112ABCD1234 đã giao hàng thành công', 'ORDER_DELIVERED'],
    ['Xác nhận thanh toán thành công', 'PAYMENT_CONFIRMED'],
    ['Bạn đã xác nhận hình thức vận chuyển cho yêu cầu trả hàng #2601250001', 'RETURN_SHIPPING'],
    ['Yêu cầu trả hàng #2601250001 được chấp nhận', 'RETURN_ACCEPTED'],
    ['Kết quả xử lý yêu cầu trả hàng #2606010001', 'RETURN_RESULT'],
    ['Kết quả xử lý yêu cầu trả hàng/hoàn tiền #2605270001', 'RETURN_RESULT'],
    ['Yêu cầu Trả hàng/Hoàn tiền #2605270001 đã được tiếp nhận', 'RETURN_REQUESTED'],
  ])('%s → %s', (subject, kind) => {
    expect(classifyShopeeSubject(subject)).toBe(kind);
  });

  it.each([
    'Xin chào Thang Shopee muốn lắng nghe ý kiến của bạn!',
    '[Shopee Affiliate] NHẬN NGAY 1000 XU CÙNG SIÊU SAO KOC - SIÊU XU VỀ MÊ LY',
    'TẾT SẮP ĐẾN - BIẾN ĐƠN HÀNG SHOPEE CŨ TRỞ THÀNH THU NHẬP MỚI NGAY !!!',
    '[CƠ HỘI CUỐI THÁNG 11] ĐƠN HÀNG SHOPEE CŨ ĐANG CHỜ TRỞ THÀNH THU NHẬP MỚI CỦA BẠN VÀ CƠ HỘI RINH TỔNG 1000 XU !!!',
    'Cảnh báo: Đăng nhập lạ vào tài khoản Shopee của bạn',
    'Cảnh báo: Tài khoản Shopee của bạn vừa được kích hoạt Đăng nhập nhanh',
    '🎉🎉🎉 LÀM QUEN “HỘI BẠN THÂN” NHÀ CAM TRƯỚC NGÀY KHAI GIẢNG',
  ])('ignores %s', (subject) => {
    expect(classifyShopeeSubject(subject)).toBeNull();
  });
});
