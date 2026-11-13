# Soi Đơn — Kế hoạch xây dựng MVP

> **Một câu:** Người dùng kết nối Gmail → Soi Đơn đọc *chỉ* email đơn hàng Shopee → chuẩn hóa thành giao dịch → dashboard trả lời *"12 tháng qua tôi đã chi bao nhiêu, cho gì, và nên cắt ở đâu?"*

Tài liệu này dùng làm "nguồn sự thật" khi xây bằng Claude Code. Mỗi phase có danh sách task và **Definition of Done (DoD)** để giao từng phần cho Claude Code.

---

## 0. Nguyên tắc

1. **Shopee VN + Gmail trước.** TikTok Shop chỉ thêm khi Shopee chạy ổn.
2. **Rule-based parser trước, LLM sau.** Parser phải deterministic, có test fixtures. LLM chỉ là fallback (phase sau).
3. **Privacy là feature.** Không lưu toàn văn email. Chỉ lưu các trường đã extract.
4. **Đúng tiền > đẹp UI.** Tổng chi phải dựa trên số tiền thực trả (net), tách hoàn tiền riêng.
5. **Mỗi đơn = một transaction.** `orderId` là khóa dedupe.

---

## 1. Phạm vi MVP

### Làm
- [ ] Đăng nhập Google + cấp quyền `gmail.readonly`
- [ ] Quét email Shopee trong 12 tháng (tùy chọn 24 tháng)
- [ ] Trích đơn hàng từ email xác nhận / giao thành công / hủy / hoàn tiền
- [ ] Dedupe theo mã đơn
- [ ] Tính chi tiêu thực tế (sau voucher, phí ship, trừ hoàn tiền)
- [ ] Dashboard theo tháng, danh mục, shop, sản phẩm
- [ ] Hàng chờ review cho giao dịch confidence thấp
- [ ] Sửa danh mục (hệ thống nhớ quy tắc)
- [ ] Export CSV
- [ ] Ngắt kết nối Gmail và xóa toàn bộ dữ liệu

### Không làm trong MVP
- Đọc/lưu toàn bộ hộp thư
- Yêu cầu mật khẩu Shopee / TikTok Shop
- Ngân sách, cảnh báo, gợi ý đầu tư, kết nối ngân hàng
- App mobile native (web responsive là đủ)
- Export PDF (để sau)

---

## 2. Tech stack

| Thành phần | Lựa chọn | Ghi chú |
|---|---|---|
| Monorepo | pnpm workspaces + Turborepo | |
| Frontend | Next.js (App Router) + TypeScript | Tailwind + shadcn/ui, Recharts cho biểu đồ |
| Data fetching FE | TanStack Query | Gọi API NestJS |
| Backend | NestJS + TypeScript | REST API |
| ORM | Prisma | Schema + migrations nằm trong `packages/db` |
| Database | PostgreSQL 16 | |
| Queue | Redis + BullMQ (`@nestjs/bullmq`) | Job quét Gmail chạy nền |
| Gmail | `googleapis` (Gmail API v1) | Không dùng IMAP |
| HTML parsing | `cheerio` | |
| Validation | `zod` (shared) hoặc `class-validator` ở API | Ưu tiên zod schema dùng chung FE/BE |
| Auth session | JWT trong httpOnly cookie do NestJS phát | |
| Mã hóa | AES-256-GCM (Node `crypto`), key từ env/KMS | Envelope encryption khi lên production |
| Test | Vitest/Jest + fixtures email thật đã ẩn danh | |
| Local dev | Docker Compose (Postgres + Redis) | |

---

## 3. Cấu trúc repo

```
soi-don/
├── apps/
│   ├── web/                    # Next.js
│   │   ├── app/
│   │   │   ├── (marketing)/    # landing, privacy, terms
│   │   │   ├── onboarding/     # consent + kết nối Gmail
│   │   │   ├── dashboard/
│   │   │   ├── transactions/
│   │   │   ├── review/
│   │   │   └── settings/
│   │   └── lib/api.ts
│   └── api/                    # NestJS
│       └── src/
│           ├── auth/
│           ├── gmail/          # OAuth token, Gmail client
│           ├── ingestion/      # BullMQ processors
│           ├── parser/         # Shopee parsers + registry
│           ├── transactions/
│           ├── categories/
│           ├── analytics/
│           ├── export/
│           ├── privacy/        # disconnect, delete-all, audit log
│           └── common/crypto/
├── packages/
│   ├── db/                     # prisma/schema.prisma, client export
│   ├── shared/                 # zod schemas, types, enums, money utils
│   └── parser-fixtures/        # email HTML đã ẩn danh + expected JSON
├── docker-compose.yml
├── turbo.json
├── CLAUDE.md
└── SOI_DON_PLAN.md
```

---

## 4. Luồng dữ liệu

```
[Web] Đăng nhập Google (openid, email)
   ↓
[Web] Consent screen của Soi Đơn → bấm "Kết nối Gmail"
   ↓
[API] OAuth thêm scope gmail.readonly (access_type=offline)
   ↓ lưu refresh token đã mã hóa
[API] Tạo ScanJob → đẩy vào queue `gmail-scan`
   ↓
[Worker] messages.list(q = bộ lọc Shopee + after:) → danh sách message id
   ↓ (phân trang, rate limit)
[Worker] messages.get(id, format=full) → decode HTML
   ↓
[Parser] detect template → extract → ParsedOrderEvent (+ confidence)
   ↓
[Normalizer] gộp các event theo orderId → upsert Transaction + Items
   ↓
[Categorizer] user rules → keyword rules → "Khác"
   ↓
[Analytics] SQL aggregate → API → Dashboard
```

Một đơn hàng có thể sinh nhiều email (đặt hàng, đang giao, giao thành công, hoàn tiền). Mỗi email tạo một `OrderEvent`; Transaction là trạng thái **tổng hợp** của các event cùng `orderId`.

---

## 5. Data model (Prisma, bản nháp)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Platform {
  SHOPEE
  TIKTOK_SHOP
}

enum ConnectionStatus {
  ACTIVE
  REVOKED
  ERROR
}

enum TxStatus {
  PENDING
  COMPLETED
  CANCELLED
  REFUNDED          // hoàn toàn bộ
  PARTIALLY_REFUNDED
}

enum EventType {
  ORDER_PLACED
  ORDER_SHIPPED
  ORDER_DELIVERED
  ORDER_CANCELLED
  REFUND
  UNKNOWN
}

enum ScanStatus {
  QUEUED
  RUNNING
  DONE
  FAILED
}

enum RuleMatch {
  PRODUCT_KEYWORD
  SHOP_NAME
}

model User {
  id          String   @id @default(uuid())
  email       String   @unique
  googleSub   String   @unique
  displayName String?
  createdAt   DateTime @default(now())
  deletedAt   DateTime?

  connections   EmailConnection[]
  scanJobs      ScanJob[]
  processed     ProcessedEmail[]
  transactions  Transaction[]
  categoryRules CategoryRule[]
  auditLogs     AuditLog[]
}

model EmailConnection {
  id                    String           @id @default(uuid())
  userId                String
  provider              String           @default("gmail")
  refreshTokenEncrypted String           // AES-256-GCM, base64(iv|tag|ciphertext)
  scopes                String[]
  status                ConnectionStatus @default(ACTIVE)
  lastSyncedAt          DateTime?
  createdAt             DateTime         @default(now())
  user                  User             @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, provider])
}

model ScanJob {
  id            String     @id @default(uuid())
  userId        String
  status        ScanStatus @default(QUEUED)
  rangeFrom     DateTime
  rangeTo       DateTime
  totalMessages Int        @default(0)
  processed     Int        @default(0)
  parsedOk      Int        @default(0)
  failed        Int        @default(0)
  error         String?
  startedAt     DateTime?
  finishedAt    DateTime?
  createdAt     DateTime   @default(now())
  user          User       @relation(fields: [userId], references: [id], onDelete: Cascade)
}

/// Chỉ lưu metadata để không xử lý lại email. KHÔNG lưu nội dung.
model ProcessedEmail {
  id             String    @id @default(uuid())
  userId         String
  gmailMessageId String
  receivedAt     DateTime
  templateId     String?   // vd "shopee.order_delivered.v1"
  parserVersion  String?
  eventType      EventType @default(UNKNOWN)
  parsedOk       Boolean
  user           User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, gmailMessageId])
}

model Transaction {
  id             String   @id @default(uuid())
  userId         String
  platform       Platform
  orderId        String?  // null nếu không trích được → dùng fingerprint
  fingerprint    String   // hash(date + shop + total + items) để dedupe dự phòng
  orderDate      DateTime
  shopName       String?
  // Tiền: VND nguyên (đồng), không dùng float
  grossAmount    Int      @default(0) // tổng tiền hàng
  discountAmount Int      @default(0) // voucher, xu, giảm giá
  shippingFee    Int      @default(0)
  netAmount      Int      @default(0) // số tiền thực trả
  refundAmount   Int      @default(0) // hiển thị riêng, không trộn vào chi tiêu
  status         TxStatus @default(PENDING)
  confidence     Float    @default(1)  // 0..1
  needsReview    Boolean  @default(false)
  userConfirmed  Boolean  @default(false)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  user   User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  items  TransactionItem[]
  events OrderEvent[]

  @@unique([userId, platform, orderId])
  @@unique([userId, platform, fingerprint])
  @@index([userId, orderDate])
}

model TransactionItem {
  id            String      @id @default(uuid())
  transactionId String
  productName   String
  variant       String?
  quantity      Int         @default(1)
  unitPrice     Int
  lineTotal     Int
  categoryId    String?
  categorySource String?    // "user_rule" | "keyword" | "default"
  transaction   Transaction @relation(fields: [transactionId], references: [id], onDelete: Cascade)
  category      Category?   @relation(fields: [categoryId], references: [id])
}

/// Mỗi email đã parse thành công tạo một event, gắn vào Transaction.
model OrderEvent {
  id             String      @id @default(uuid())
  transactionId  String
  gmailMessageId String
  type           EventType
  occurredAt     DateTime
  amount         Int?        // số tiền nêu trong email (vd số tiền hoàn)
  transaction    Transaction @relation(fields: [transactionId], references: [id], onDelete: Cascade)

  @@unique([transactionId, gmailMessageId])
}

model Category {
  id       String     @id @default(uuid())
  slug     String     @unique   // "thoi-trang", "my-pham"...
  name     String
  parentId String?
  parent   Category?  @relation("CategoryTree", fields: [parentId], references: [id])
  children Category[] @relation("CategoryTree")
  items    TransactionItem[]
  rules    CategoryRule[]
}

/// Quy tắc người dùng tạo khi sửa danh mục → áp dụng cho lần sau.
model CategoryRule {
  id         String    @id @default(uuid())
  userId     String
  match      RuleMatch
  pattern    String    // đã normalize: lowercase, bỏ dấu
  categoryId String
  createdAt  DateTime  @default(now())
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  category   Category  @relation(fields: [categoryId], references: [id])

  @@unique([userId, match, pattern])
}

model AuditLog {
  id        String   @id @default(uuid())
  userId    String?
  action    String   // "gmail.connected", "scan.started", "data.deleted"...
  meta      Json?
  createdAt DateTime @default(now())
  user      User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
}
```

**Ghi chú:**
- Tiền dùng `Int` (VND, đơn vị đồng). Một đơn tối đa ~2,1 tỷ là đủ cho MVP. Tổng hợp dùng `SUM(...)::bigint` trong SQL và serialize sang `number`/`string` ở API.
- Hai unique constraint (`orderId`, `fingerprint`) giúp upsert idempotent khi quét lại.
- `AuditLog` dùng `SetNull` để vẫn giữ log "đã xóa dữ liệu" sau khi xóa user (không chứa PII trong `meta`).

---

## 6. Công thức tiền (quan trọng nhất)

```
netAmount   = số "Tổng thanh toán" trong email (ưu tiên lấy trực tiếp)
            ≈ grossAmount - discountAmount + shippingFee   (dùng để kiểm tra chéo)
refundAmount = tổng các event REFUND

Chi tiêu thực tế (dashboard) = SUM(netAmount) WHERE status IN (COMPLETED, PARTIALLY_REFUNDED, PENDING*)
Hoàn tiền (hiển thị riêng)    = SUM(refundAmount)
Chi tiêu ròng                 = Chi tiêu thực tế - Hoàn tiền
```
\* `PENDING` chỉ tính nếu đơn quá 30 ngày chưa bị hủy (cấu hình được). `CANCELLED` không bao giờ tính.

Nếu `grossAmount - discountAmount + shippingFee` lệch `netAmount` quá 1.000đ → giảm `confidence`, đẩy vào review.

Phân bổ chi tiêu theo danh mục: phân bổ `netAmount` của đơn cho từng item theo tỉ lệ `lineTotal / grossAmount` (để voucher và phí ship được chia đều, tổng danh mục khớp tổng chi).

---

## 7. Gmail ingestion

### OAuth
- Scope: `openid`, `email`, `https://www.googleapis.com/auth/gmail.readonly`. Không xin `gmail.modify` hay `https://mail.google.com/`.
- Đăng nhập trước với `openid email`, sau đó **incremental authorization** xin `gmail.readonly` ở bước consent riêng (giúp tỉ lệ đồng ý cao hơn và dễ giải thích).
- `access_type=offline`, `prompt=consent` để chắc chắn có refresh token.
- Validate `state` (CSRF) và kiểm tra Google thực sự cấp đủ scope.

### Truy vấn
```
from:(shopee.vn OR shopee.com) after:2025/11/12 -in:spam -in:trash
```
- `messages.list` phân trang `pageToken`, `maxResults=500`.
- `messages.get(format=full)` → tìm part `text/html`, decode base64url.
- Kiểm tra lại header `From` sau khi fetch (không tin hoàn toàn vào query).
- Bỏ qua email đã có trong `ProcessedEmail` (trừ khi `parserVersion` mới hơn và lần trước thất bại).

### Worker
- Queue `gmail-scan`: 1 job/user, chia batch 50 message.
- Concurrency thấp (2–4) và exponential backoff khi gặp `429` / `403 rateLimitExceeded`.
- Cập nhật `ScanJob.processed` để FE hiển thị tiến độ (polling 2s, hoặc SSE).
- Refresh token bị thu hồi (`invalid_grant`) → `EmailConnection.status = REVOKED`, báo người dùng kết nối lại.
- Quét tăng dần: lần sau chỉ `after:lastSyncedAt`.

### Raw email
- Mặc định **không lưu**. Xử lý xong trong bộ nhớ là bỏ.
- Chế độ debug (chỉ cho tài khoản của bạn / beta user đồng ý): lưu HTML đã mã hóa, TTL 7 ngày, có cron xóa.

---

## 8. Parser

### Interface
```ts
interface EmailInput {
  messageId: string;
  from: string;
  subject: string;
  receivedAt: Date;
  html: string;
  text?: string;
}

interface ParsedOrderEvent {
  platform: 'SHOPEE';
  templateId: string;          // "shopee.order_confirmed.v1"
  eventType: EventType;
  orderId?: string;
  orderDate?: Date;
  shopName?: string;
  items: { name: string; variant?: string; quantity: number; unitPrice: number; lineTotal: number }[];
  grossAmount?: number;
  discountAmount?: number;
  shippingFee?: number;
  netAmount?: number;
  refundAmount?: number;
  confidence: number;          // 0..1
  warnings: string[];
}

interface EmailParser {
  id: string;
  canParse(input: EmailInput): boolean;   // dựa trên sender + subject + marker trong HTML
  parse(input: EmailInput): ParsedOrderEvent;
}
```

- `ParserRegistry` thử lần lượt các parser; không parser nào nhận → `ProcessedEmail.parsedOk=false, eventType=UNKNOWN` (để biết template nào còn thiếu).
- Util dùng chung: `parseVnd("₫1.234.567") → 1234567`, normalize tiếng Việt (bỏ dấu, lowercase), parse ngày dạng `dd/MM/yyyy`, `dd-MM-yyyy HH:mm`.
- Mã đơn Shopee: regex cho chuỗi chữ-số in hoa ~14 ký tự gần nhãn "Mã đơn hàng". Xác nhận bằng fixtures thật.

### Fixtures (bắt buộc)
- Lấy 5–10 template từ chính hộp thư của bạn, **ẩn danh** (tên, địa chỉ, SĐT) bằng script.
- Mỗi fixture: `xxx.html` + `xxx.expected.json`. Test chạy toàn bộ fixtures.
- Thêm template mới = thêm fixture trước, rồi viết parser (TDD).

---

## 9. Categorization

Thứ tự ưu tiên:
1. `CategoryRule` của user (khớp shop hoặc keyword sản phẩm)
2. Bảng keyword mặc định (seed), vd:
   - `my-pham`: son, kem chống nắng, serum, toner, sữa rửa mặt…
   - `thoi-trang`: áo, quần, váy, giày, túi…
   - `dien-tu`: tai nghe, sạc, cáp, ốp lưng…
   - `gia-dung`, `thuc-pham`, `me-va-be`, `sach-van-phong-pham`, `the-thao`, `thu-cung`, `khac`
3. Mặc định `khac`

Khi user đổi danh mục của 1 item → hỏi "Áp dụng cho các sản phẩm tương tự?" → tạo `CategoryRule` + re-categorize các item khớp.

LLM fallback cho categorization: **phase sau**, chỉ chạy với item rơi vào `khac`, chỉ gửi tên sản phẩm (không gửi thông tin cá nhân).

---

## 10. API (NestJS)

| Method | Path | Mô tả |
|---|---|---|
| GET | `/auth/google` | Bắt đầu đăng nhập |
| GET | `/auth/google/callback` | Callback, set cookie |
| POST | `/auth/logout` | |
| GET | `/me` | User + trạng thái kết nối |
| GET | `/gmail/connect` | Xin scope `gmail.readonly` |
| GET | `/gmail/callback` | Lưu refresh token mã hóa |
| POST | `/gmail/disconnect` | Revoke token ở Google + xóa token |
| POST | `/scans` | `{ months: 12 \| 24 }` → tạo ScanJob |
| GET | `/scans/:id` | Tiến độ |
| GET | `/transactions` | Filter: from, to, category, shop, status; phân trang |
| PATCH | `/transactions/:id` | Sửa / xác nhận |
| DELETE | `/transactions/:id` | Xóa 1 giao dịch |
| PATCH | `/items/:id/category` | `{ categoryId, applyToSimilar }` |
| GET | `/review` | Giao dịch `needsReview=true` |
| GET | `/analytics/summary` | Tổng chi, hoàn tiền, số đơn, trung bình đơn/tháng |
| GET | `/analytics/monthly` | Chi theo tháng (12 tháng) |
| GET | `/analytics/categories` | Breakdown danh mục |
| GET | `/analytics/shops` | Top shop |
| GET | `/analytics/products` | Top sản phẩm |
| GET | `/analytics/insights` | Câu insight sinh từ rule |
| GET | `/export/csv` | |
| DELETE | `/me/data` | Xóa toàn bộ dữ liệu + revoke Gmail |

Mọi query đều scope theo `userId` từ session (guard + Prisma middleware/extension để không quên `where userId`).

### Insights (rule-based, chưa cần LLM)
- Tháng chi cao nhất
- Danh mục tăng mạnh nhất quý này vs quý trước (> 20%)
- Shop mua nhiều nhất
- Số đơn trung bình/tháng
- "Đơn nhỏ lẻ": số đơn < 50.000đ và tổng phí ship của chúng

Mẫu: *"Bạn chi 4,2 triệu cho mỹ phẩm trong Q3, tăng 38% so với Q2."*

---

## 11. Frontend (Next.js)

| Route | Nội dung |
|---|---|
| `/` | Landing + waitlist + CTA "Soi chi tiêu Shopee của bạn" |
| `/privacy`, `/terms` | Bắt buộc cho Google verification |
| `/onboarding` | Giải thích: chỉ đọc email Shopee, không đọc email khác, không bán dữ liệu, xóa bất cứ lúc nào → nút Kết nối Gmail |
| `/onboarding/scanning` | Thanh tiến độ, số email/đơn đã tìm thấy |
| `/dashboard` | 4 câu hỏi: Chi bao nhiêu? Cho gì? Ở đâu? Có tăng không? + insights |
| `/transactions` | Bảng, filter, sửa danh mục |
| `/review` | Hàng chờ xác nhận |
| `/settings` | Ngắt Gmail, quét lại, export CSV, xóa toàn bộ dữ liệu |

Định dạng tiền: `Intl.NumberFormat('vi-VN')` → "38,6 triệu" cho số lớn, "1.234.000đ" cho chi tiết.

---

## 12. Bảo mật & tuân thủ

### Kỹ thuật
- [ ] Refresh token mã hóa AES-256-GCM; key `TOKEN_ENC_KEY` từ secret manager (production: KMS envelope encryption)
- [ ] Không log nội dung email, tên sản phẩm hay số tiền ở level info (log chỉ có id/count)
- [ ] Cookie `httpOnly`, `secure`, `sameSite=lax`; CORS chỉ cho domain web
- [ ] Rate limit API (`@nestjs/throttler`)
- [ ] Xóa dữ liệu: transaction → items/events → processed emails → connections (revoke token ở Google) → user; ghi AuditLog
- [ ] DB backup có mã hóa; chính sách retention ghi rõ

### Google
- `gmail.readonly` là **restricted scope**. Muốn public cho mọi người cần OAuth app verification, và có thể phải qua **security assessment (CASA)** hằng năm vì dữ liệu đi qua server.
- Khi app còn ở chế độ **Testing**: tối đa 100 test user (phải thêm email thủ công), và refresh token **hết hạn sau 7 ngày**. Đủ cho beta 50–100 người, nhưng phải có luồng "kết nối lại" mượt.
- Tên app, logo, homepage, privacy policy phải nhất quán; không dùng "Gmail"/"Google"/"Shopee" trong tên app.
- Privacy policy phải tuân thủ Google API Services User Data Policy (Limited Use).

### Việt Nam — Nghị định 13/2023/NĐ-CP
- [ ] Màn hình consent nêu rõ: mục đích, loại dữ liệu, ai xử lý, thời gian lưu, quyền của người dùng
- [ ] Người dùng có thể xem, sửa, rút lại đồng ý, xóa dữ liệu (đã có trong Settings)
- [ ] Ghi lại thời điểm và phiên bản consent (AuditLog)
- [ ] Hỏi ý kiến luật sư về hồ sơ đánh giá tác động xử lý dữ liệu cá nhân trước khi mở public

---

## 13. Lộ trình

### Phase 0 — Spike kiểm chứng dữ liệu (2–3 ngày, làm TRƯỚC mọi thứ)
Rủi ro lớn nhất: email Shopee có đủ thông tin không (có gửi email cho mọi đơn không, có giá từng item không, có voucher/phí ship không).
- [ ] Script Node độc lập: OAuth với tài khoản của bạn → list email Shopee 12 tháng → lưu HTML vào thư mục local (gitignore)
- [ ] Đếm: bao nhiêu email, bao nhiêu template khác nhau (group theo subject), so với số đơn thực tế trong app Shopee
- [ ] Ghi kết quả vào `docs/data-spike.md`

**DoD:** Biết được % đơn có email và danh sách template cần hỗ trợ. Nếu < 60% đơn có email → xem lại hướng sản phẩm trước khi code tiếp.

### Phase 1 — Nền tảng (tuần 1)
- [ ] Monorepo pnpm + Turborepo, `apps/web`, `apps/api`, `packages/db`, `packages/shared`
- [ ] Docker Compose: Postgres + Redis
- [ ] Prisma schema (mục 5), migration đầu tiên, seed categories + keyword rules
- [ ] ESLint, Prettier, tsconfig dùng chung; `.env.example`
- [ ] NestJS: config module, health check, Prisma service
- [ ] Next.js: layout, Tailwind, shadcn/ui

**DoD:** `pnpm dev` chạy cả web + api; `pnpm db:migrate` và `pnpm db:seed` chạy được.

### Phase 2 — Auth + Gmail OAuth (tuần 2)
- [ ] Đăng nhập Google, session JWT cookie
- [ ] Module crypto (encrypt/decrypt + test)
- [ ] Luồng connect Gmail với incremental scope, lưu token mã hóa
- [ ] Disconnect (revoke ở Google)
- [ ] Trang onboarding + consent
- [ ] AuditLog cho connect/disconnect

**DoD:** Đăng nhập → kết nối Gmail → DB có token đã mã hóa → ngắt kết nối thì token bị xóa và revoke.

### Phase 3 — Parser (tuần 2–3, song song)
- [ ] Script ẩn danh fixtures
- [ ] Utils: `parseVnd`, normalize tiếng Việt, parse ngày
- [ ] Parser cho 5–10 template Shopee phổ biến nhất (theo kết quả Phase 0)
- [ ] `ParserRegistry` + test chạy toàn bộ fixtures

**DoD:** 100% fixtures pass; mỗi parser có ít nhất 2 fixtures.

### Phase 4 — Ingestion pipeline (tuần 3–4)
- [ ] BullMQ queue + processor `gmail-scan`
- [ ] list/get message, decode HTML, gọi registry
- [ ] Normalizer: gộp event theo orderId, upsert Transaction/Item/Event, tính status + confidence
- [ ] Categorizer
- [ ] API `/scans`, trang tiến độ
- [ ] Quét lại idempotent (chạy 2 lần không tạo trùng)

**DoD:** Quét hộp thư của bạn, số đơn và tổng chi khớp với lịch sử trong app Shopee (sai lệch < 5%).

### Phase 5 — Dashboard (tuần 5)
- [ ] Analytics endpoints (mục 10) bằng Prisma `$queryRaw` hoặc `groupBy`
- [ ] Dashboard: tổng chi, biểu đồ theo tháng, donut danh mục, top shop, top sản phẩm, so sánh kỳ trước
- [ ] Insights rule-based

**DoD:** Dashboard trả lời được 4 câu hỏi với dữ liệu thật của bạn.

### Phase 6 — Review, sửa, xóa, export (tuần 6)
- [ ] Trang transactions + filter
- [ ] Review queue
- [ ] Sửa danh mục + "áp dụng cho sản phẩm tương tự"
- [ ] Export CSV (UTF-8 BOM để Excel đọc đúng tiếng Việt)
- [ ] Xóa toàn bộ dữ liệu

**DoD:** Người dùng sửa được mọi sai sót và xóa sạch dữ liệu của mình.

### Phase 7 — Beta (tuần 7–10)
- [ ] Deploy (web: Vercel; api + worker + Postgres + Redis: Railway/Render, hoặc cluster K8s sẵn có)
- [ ] Sentry (đã lọc PII), metrics cơ bản
- [ ] Mời 50–100 test user (thêm vào OAuth consent screen)
- [ ] Đo metrics (mục 14); thu template email bị fail để bổ sung parser
- [ ] Đánh giá email TikTok Shop

### Phase 8 — Chuẩn bị public (tuần 11–12)
- [ ] Privacy policy, terms, retention policy
- [ ] Nộp Google OAuth verification (+ chuẩn bị CASA)
- [ ] Rà soát Nghị định 13
- [ ] Quyết định monetization (miễn phí trước)

---

## 14. Metrics

| Metric | Định nghĩa | Cách đo |
|---|---|---|
| Gmail consent rate | % người vào onboarding bấm và hoàn thành kết nối | AuditLog |
| Activation | % người kết nối thành công và thấy ≥ 10 giao dịch | ScanJob + count transactions |
| Parse rate | % email Shopee parse thành công | `ProcessedEmail.parsedOk` |
| Accuracy | % giao dịch user xác nhận đúng / không phải sửa | `userConfirmed`, số lần sửa |
| Week-4 retention | % quay lại sau 4 tuần | event log lượt xem dashboard |
| Willingness to pay | % beta user nói sẵn sàng trả | khảo sát |

---

## 15. Rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| Shopee không gửi email cho mọi đơn / email thiếu chi tiết item | Phase 0 kiểm chứng trước; nếu thiếu thì cho phép nhập/import thủ công |
| Template email thay đổi | Fixtures + alert khi parse rate giảm; LLM fallback ở phase sau |
| Người dùng không dám cấp quyền Gmail | Consent rõ ràng, chỉ readonly, nút xóa dữ liệu dễ thấy; đo từ landing page |
| Google verification / CASA tốn thời gian, chi phí | Bắt đầu chuẩn bị từ Phase 7; beta dùng chế độ Testing |
| Refresh token hết hạn 7 ngày khi Testing | Luồng "kết nối lại" một chạm; quét đủ 12 tháng ngay lần đầu |

---

## 16. Làm việc với Claude Code

### Gợi ý `CLAUDE.md` ở gốc repo
```md
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
```

### Cách giao việc
Giao từng phase, kèm DoD. Ví dụ:

> Đọc SOI_DON_PLAN.md. Thực hiện Phase 1. Dừng lại khi đạt DoD, chạy `pnpm dev` và `pnpm db:migrate` để kiểm chứng, rồi tóm tắt những gì đã làm.

> Thực hiện Phase 3. Fixtures nằm trong `packages/parser-fixtures`. Viết test trước, mỗi template một parser, chạy test đến khi pass hết.

Mẹo:
- Dùng plan mode cho Phase 4 (pipeline phức tạp nhất) để duyệt thiết kế trước khi code.
- Sau mỗi phase, commit và cập nhật checkbox trong file này.
- Đặt fixtures email thật vào thư mục gitignore cho đến khi đã ẩn danh.
