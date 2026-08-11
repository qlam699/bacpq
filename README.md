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

## Production / VPS (`bac.codayroi.com`)

DNS: record **A** `bac.codayroi.com` → IP VPS. Rồi trên Ubuntu (root):

```bash
git clone <repo> /var/www/bacpq
cd /var/www/bacpq
sudo CERTBOT_EMAIL=you@example.com bash scripts/setup-vps.sh
# điền VAPID trong /var/www/bacpq/.env
sudo -u bacpq npx --yes web-push generate-vapid-keys
sudo nano /var/www/bacpq/.env
sudo bash scripts/setup-vps.sh    # start service + HTTPS
```

Cập nhật code:

```bash
sudo bash /var/www/bacpq/scripts/deploy.sh
```

- App: `127.0.0.1:8787` — Nginx reverse proxy + Let's Encrypt
- Subscriptions: `/var/lib/bacpq` (không xóa khi deploy)
- Log: `journalctl -u bacpq -f`

## Production / Zeabur

Một service: Express serve `dist/` + `/api/*`. `zbpack.json` ép build/start Node (đừng set `ZBPACK_OUTPUT_DIR` — Zeabur sẽ chỉ host static, mất SSE/push).

### 1. Push code lên GitHub

```bash
git push -u origin HEAD
```

### 2. Tạo project trên [Zeabur](https://zeabur.com)

1. **New Project** → chọn region gần VN nếu có.
2. **Add Service** → **GitHub** → authorize → chọn repo `bacpq`.
3. Build plan phải là **Node.js** (không phải static/Caddy).
4. **Deploy**.

### 3. Variables (service → Variables)

| Biến | Giá trị |
|------|---------|
| `VAPID_PUBLIC_KEY` | output `npx web-push generate-vapid-keys` |
| `VAPID_PRIVATE_KEY` | cùng cặp key |
| `VAPID_SUBJECT` | `mailto:you@example.com` |
| `DATA_DIR` | `/data` |
| `POLL_MS` | `2000` (optional) |

`PORT` Zeabur tự set — không hardcode.

Redeploy sau khi thêm biến.

### 4. Domain

Service → **Networking** → **Generate Domain** (HTTPS `*.zeabur.app`). Web Push cần HTTPS.

### 5. Volume (giữ subscription khi restart)

Service → **Volumes** → mount **`/data`**. Free tier: volume có thể tính phí / mất zero-downtime; không mount thì mất subscription mỗi lần redeploy.

### 6. Kiểm tra

- `https://<domain>/api/health` → `"ok": true`, `"push": true`
- Mở trang, giá SSE chạy, **Bật TB** trên Chrome/Firefox

Local: `npm run build && npm start` (cùng lệnh Zeabur).

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
