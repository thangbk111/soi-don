/** Email nhận yêu cầu về dữ liệu / hỗ trợ. Phải đặt trước khi public và trùng với OAuth consent screen. */
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? null;

/** Ngày cập nhật chính sách. Đổi nội dung /privacy hoặc /terms thì đổi ngày này. */
export const LEGAL_UPDATED = '13/11/2026';

export const GOOGLE_USER_DATA_POLICY_URL =
  'https://developers.google.com/terms/api-services-user-data-policy';
