# Soi Đơn
Đọc SOI_DON_PLAN.md trước khi làm bất cứ task nào.

## Quy ước
- TypeScript strict. Không dùng `any`.
- Tiền là số nguyên VND (Int). Không bao giờ dùng float cho tiền.
- Mọi query DB phải scope theo userId.
- Không log nội dung email, tên sản phẩm, số tiền, token.
- Không lưu raw email trừ chế độ debug có TTL.
- Parser: viết fixture + expected JSON trước, rồi mới viết code.
- Mỗi thay đổi schema = một Prisma migration có tên rõ ràng.

## Lệnh
- pnpm dev / pnpm test / pnpm lint
- pnpm db:migrate / pnpm db:seed / pnpm db:studio
