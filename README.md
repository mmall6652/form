# KHẢO SÁT NGUYỆN VỌNG - HUB ĐÀ NẴNG

Form đăng ký nguyện vọng cho nhân viên Hub Đà Nẵng. Mỗi người gửi 1 lần.
Danh sách 22 nhân viên được chọn từ dropdown; quản lý xem trạng thái đã/chưa tại `/status.html`.

## Chạy local

```bash
cp .env.example .env.local   # điền Upstash REST URL/token và ADMIN_TOKEN
npx vercel dev               # http://localhost:3000
```

## Deploy Vercel

```bash
npx vercel          # login lần đầu, liên kết project
npx vercel --prod
```

Trên Vercel Dashboard → Project → Settings → Environment Variables, thêm:

- `UPSTASH_REDIS_REST_URL` — từ Upstash console (REST URL)
- `UPSTASH_REDIS_REST_TOKEN` — từ Upstash console (REST token)
- `ADMIN_TOKEN` — tự đặt, chỉ bạn biết (dùng để mở `/status.html`)

## Cấu trúc dữ liệu

Redis key `ksat:v1:responses` là hash: field = họ tên (chuẩn hóa), value = JSON:
`{ fullName, aspiration, branch, otherText, submittedAt }`.
Ghi bằng `HSETNX` → chặn gửi trùng atomic. Xóa bản ghi test bằng `HDEL ksat:v1:responses "<họ tên>"`.

## Verify không cần credential

```bash
node tests/verify-server.mjs   # mock Upstash tại boundary, chạy :3100
# curl thử /api/submit, /api/status như trong plan
```
# form
