# Bạc Phú Quý Tracker

Theo dõi giá bạc Phú Quý (CTJ): chart trong ngày, quản lý vị thế, Web Push khi giá đổi.

**Kiến trúc:** chỉ server Node gọi CTJ → SSE cập nhật UI + Web Push. SPA không poll public API.

## Dev local

```bash
npm install
# Optional: VAPID cho Web Push
npx web-push generate-vapid-keys
export VAPID_PUBLIC_KEY=...
export VAPID_PRIVATE_KEY=...
export VAPID_SUBJECT=mailto:you@example.com

npm run dev
```

- Web (Vite): http://localhost:5173 (proxy `/api` → server)
- Server: http://127.0.0.1:8787

Web Push trên Linux: dùng **Google Chrome** hoặc **Firefox**. Chromium/ungoogled/Brave thường báo `Registration failed - push service error` vì thiếu Google FCM. Brave: Settings → Privacy → bật *Use Google services for push messaging*.

## Production / Zeabur

```bash
npm run build
npm start
```

`start` chạy Express: serve `dist/` + `/api/*`. Zeabur dùng script `start`, set `PORT` tự động.

### Env

| Biến | Mô tả |
|------|--------|
| `PORT` | HTTP port (Zeabur set sẵn) |
| `VAPID_PUBLIC_KEY` | Public key Web Push |
| `VAPID_PRIVATE_KEY` | Private key Web Push |
| `VAPID_SUBJECT` | VD `mailto:you@example.com` |
| `DATA_DIR` | Thư mục lưu `subscriptions.json` (mặc định `./data`) |
| `POLL_MS` | Interval poll CTJ (mặc định `2000`) |

Trên Zeabur: mount **Volume** vào `/data` và set `DATA_DIR=/data` để không mất subscription khi restart. Cần **HTTPS** để Service Worker / Web Push hoạt động.

Poll chỉ trong **08:30–18:30 Asia/Ho_Chi_Minh**; ngoài giờ vẫn fetch một lần để có cache cho UI.
