# Deploy Soi Đơn

Hai cách, cùng một codebase:

- **A. Vercel + Railway** (đang dùng cho beta) — web trên Vercel, API + Postgres trên Railway.
- **B. VPS tự quản** — `docker-compose.prod.yml` + Caddy (HTTPS tự động) + sao lưu DB hằng ngày.

Cả hai đều cho trình duyệt thấy **một origin duy nhất**: web gọi API qua `/api/*`. Nhờ vậy cookie
phiên (`SameSite=Lax`) chạy được với domain miễn phí như `*.vercel.app`.

---

## A. Vercel + Railway

### 1. Railway — API + Postgres

1. railway.com → **New Project → Deploy from GitHub repo** → chọn repo Soi Đơn.
   Railway đọc `railway.json` ở gốc repo: build bằng `Dockerfile` (stage cuối = API),
   healthcheck `/health`. Khi khởi động, API tự chạy `prisma migrate deploy` và seed danh mục.
2. Trong project: **New → Database → PostgreSQL**.
3. Service API → **Variables**:

   | Biến                                       | Giá trị                                                                                    |
   | ------------------------------------------ | ------------------------------------------------------------------------------------------ |
   | `DATABASE_URL`                             | `${{Postgres.DATABASE_URL}}` (tham chiếu biến của service Postgres)                        |
   | `NODE_ENV`                                 | `production`                                                                               |
   | `WEB_ORIGIN`                               | `https://<tên-app>.vercel.app`                                                             |
   | `GOOGLE_REDIRECT_URI`                      | `https://<tên-app>.vercel.app/api/auth/google/callback`                                    |
   | `GMAIL_REDIRECT_URI`                       | `https://<tên-app>.vercel.app/api/gmail/callback`                                          |
   | `JWT_SECRET`                               | `openssl rand -base64 48`                                                                  |
   | `TOKEN_ENC_KEY`                            | `openssl rand -base64 32` — **khác** key local; mất key = mọi người phải kết nối Gmail lại |
   | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | từ Google Cloud Console                                                                    |
   | `SENTRY_DSN`                               | DSN project Sentry _soidon-api_ (để trống = tắt)                                           |

   Không cần đặt `PORT`: Railway tự cấp, API đọc `PORT`.

4. Service API → **Settings → Networking → Generate Domain** → được `https://<api>.up.railway.app`.
   Mở `https://<api>.up.railway.app/health` phải thấy `{"status":"ok"}`.
5. Giữ **1 replica**: việc quét Gmail chạy trong tiến trình API.

### 2. Vercel — web

1. vercel.com → **Add New → Project** → chọn repo, **Root Directory = `apps/web`**.
   `apps/web/vercel.json` đã đặt lệnh install/build cho monorepo.
2. **Environment Variables** (Production):

   | Biến                           | Giá trị                                                       |
   | ------------------------------ | ------------------------------------------------------------- |
   | `NEXT_PUBLIC_API_URL`          | `/api`                                                        |
   | `API_PROXY_TARGET`             | `https://<api>.up.railway.app` (không có `/` cuối)            |
   | `NEXT_PUBLIC_SUPPORT_EMAIL`    | email nhận yêu cầu về dữ liệu                                 |
   | `NEXT_PUBLIC_SENTRY_DSN`       | DSN project Sentry _soidon-web_ (để trống = tắt)              |
   | `ENABLE_EXPERIMENTAL_COREPACK` | `1` — để Vercel dùng đúng `pnpm@12.15.0` trong `package.json` |

   Các biến này được đọc **lúc build** → đổi biến thì phải **Redeploy**.

3. Deploy, rồi đặt tên app cố định (Settings → Domains) để URL `*.vercel.app` không đổi.

### 3. Google Cloud Console

OAuth client (Web application) → **Authorized redirect URIs**, thêm:

```
https://<tên-app>.vercel.app/api/auth/google/callback
https://<tên-app>.vercel.app/api/gmail/callback
```

OAuth consent screen → **Test users**: thêm email từng người beta (tối đa 100).
Ở chế độ Testing, refresh token hết hạn sau 7 ngày → người dùng bấm "Kết nối lại" trên trang Kết nối Gmail.

### 4. Kiểm tra sau deploy

- [ ] `https://<tên-app>.vercel.app/api/health` → `{"status":"ok"}` (đi qua proxy)
- [ ] Đăng nhập Google → về trang Kết nối Gmail
- [ ] Kết nối Gmail → quét 1 tháng → Tổng quan có số liệu
- [ ] `/privacy`, `/terms` hiện email liên hệ (không phải chữ đỏ "chưa cấu hình")
- [ ] Sentry: tạm thời không cần thử; lỗi thật sẽ hiện trong project

---

## B. VPS (Docker Compose)

```bash
git clone <repo> soidon && cd soidon
cp deploy/.env.production.example deploy/.env.production && chmod 600 deploy/.env.production
# điền các biến, SITE_ADDRESS là tên miền trỏ về IP VPS (vd DuckDNS miễn phí)
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production up -d --build
```

- Mở cổng 80 và 443. Caddy tự xin chứng chỉ HTTPS.
- Redirect URI Google: `https://<SITE_ADDRESS>/api/auth/google/callback` và `/api/gmail/callback`.
- Sao lưu: `deploy/backups/soidon-YYYYMMDD.dump` lúc ~03:00 giờ VN, giữ 14 bản.
  Chép ra ngoài VPS định kỳ. Khôi phục:
  `docker compose ... exec -T postgres pg_restore -U soidon -d soidon --clean < deploy/backups/<file>.dump`
- Cập nhật: `git pull && docker compose ... up -d --build`.

---

## Metrics beta

```bash
# Railway (cần Railway CLI, đã `railway link`)
railway run --service <api> pnpm --filter @soi-don/api exec tsx scripts/metrics.ts
# Local
pnpm --filter @soi-don/api exec tsx --env-file=../../.env scripts/metrics.ts
```

In: consent rate, activation (≥ 10 đơn), parse rate, tỉ lệ dòng không phải sửa danh mục,
week-4 retention, và email chưa đọc được theo parser/loại. Chỉ số tổng hợp, không có PII.

## Sentry

Tạo 2 project miễn phí trên sentry.io: **Node.js/NestJS** (`SENTRY_DSN`) và **Next.js**
(`NEXT_PUBLIC_SENTRY_DSN`). SDK đã cấu hình chỉ bắt lỗi (không tracing, không session replay),
tắt thu body/header/cookie/query/biến cục bộ, và che email, chuỗi trong ngoặc, số dài, token
trong mọi message (`packages/shared/src/redact.ts`).
