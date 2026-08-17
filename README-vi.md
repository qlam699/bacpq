# Bạc Phú Quý Tracker

Theo dõi giá bạc Phú Quý (CTJ): chart trong ngày, quản lý vị thế, Web Push khi giá đổi.

**Kiến trúc:** chỉ server Node gọi CTJ và Phú Quý. SPA không poll public API — chỉ gọi `/api/*` (giá live SSE, lịch sử, Web Push).

- **Live:** poller cache ticks `BPQ1L` / `BPQ10L` / `BPQ1KG` → SSE `snapshot` → header + chart trong ngày + overlay vị thế
- **Lịch sử:** `GET /api/history` proxy Phú Quý (`statistics-price/2`), cache ~90s; UI Lượng/KG, 1D–1Y, thống kê theo thứ
- **Web Push:** chỉ khi giá **1L (`BPQ1L`)** đổi; subscription lưu `/var/lib/bacpq`
- **Vị thế:** `localStorage`, hoặc GitHub Gist khi đăng nhập

## Luồng hệ thống

### Sequence: giá live (CTJ → SSE)

```mermaid
sequenceDiagram
  participant Poller
  participant CTJ as prices.ctj.com.vn
  participant Cache
  participant SSE
  participant SPA

  Poller->>Poller: moi 2s luc 08:30-18:30 VN
  loop moi productId
    Poller->>CTJ: GET /today
    CTJ-->>Poller: CtjTick[]
    Poller->>Cache: luu ticks
    alt seriesFingerprint doi
      Poller->>SSE: broadcastSnapshot
      SSE-->>SPA: event snapshot
      SPA->>SPA: cap nhat header va chart ngay
    end
    alt BPQ1L va gia mua/ban doi
      Poller->>SPA: Web Push 1L
    end
  end
```

### Sequence: Web Push 1L

```mermaid
sequenceDiagram
  participant User
  participant SPA
  participant SW as ServiceWorker
  participant API as NodeAPI
  participant Store as subscriptions.json
  participant PushSvc as PushService
  participant Poller

  User->>SPA: Bat TB
  SPA->>SW: PushManager.subscribe
  SPA->>API: POST /api/push/subscribe BPQ1L
  API->>Store: upsert
  Poller->>Poller: gia BPQ1L doi
  Poller->>Store: loc subscription BPQ1L
  Poller->>PushSvc: sendNotification
  PushSvc-->>SW: push event
  SW->>User: noti Gia bac BPQ1L
```

### Sequence: biểu đồ lịch sử

```mermaid
sequenceDiagram
  participant User
  participant SPA as HistoryChart
  participant API as HistoryAPI
  participant PQ as be.phuquy.com.vn

  User->>SPA: chon don vi va khoang ngay
  SPA->>API: GET /api/history
  alt cache 90s hit
    API-->>SPA: changeRate va points
  else miss
    API->>PQ: statistics-price/2
    PQ-->>API: BAC pricePointInfoList
    API->>API: chuan hoa va cache
    API-->>SPA: changeRate va points
  end
  SPA->>SPA: ve line chart va thong ke theo thu
```

### Activity: poller trong ngày

```mermaid
flowchart TD
  startNode([Server start]) --> vapid[Cau hinh VAPID]
  vapid --> arm[Arm poller]
  arm --> inWindow{Trong cua so 08:30-18:30 VN?}
  inWindow -->|khong| sleep[Ngu toi 08:30]
  sleep --> oneShot[Fetch 1 lan de co cache]
  oneShot --> waitStart[Cho toi 08:30]
  waitStart --> arm
  inWindow -->|co| pollAll[pollAll 3 san pham]
  pollAll --> tickLoop[Moi 2s fetch CTJ]
  tickLoop --> seriesChanged{Series doi?}
  seriesChanged -->|co| sse[Broadcast SSE]
  seriesChanged -->|khong| priceCheck
  sse --> priceCheck{La BPQ1L va gia doi?}
  priceCheck -->|co| push1L[Gui Web Push 1L]
  priceCheck -->|khong| stillOpen{Van trong cua so?}
  push1L --> stillOpen
  stillOpen -->|co| tickLoop
  stillOpen -->|khong| arm
```

### Activity: bật thông báo

```mermaid
flowchart TD
  clickNotify([User bam Bat TB]) --> support{Ho tro Web Push?}
  support -->|khong| alertNo[Alert khong ho tro]
  support -->|co| perm{Quyen thong bao?}
  perm -->|denied| alertPerm[Bao cap quyen o khoa URL]
  perm -->|granted_or_prompt| subSW[Dang ky Service Worker]
  subSW --> vapidGet[GET vapid-public-key]
  vapidGet --> subscribe[PushManager.subscribe]
  subscribe --> fcmOk{Subscribe OK?}
  fcmOk -->|khong| localOnly[Notify local khi tab dang mo]
  fcmOk -->|co| saveSub[POST subscribe chi BPQ1L]
  saveSub --> testNoti[Noti thu: day khi 1L doi]
```

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

- Web (Vite): [http://localhost:5173](http://localhost:5173) (proxy `/api` → server)
- Server: [http://127.0.0.1:8787](http://127.0.0.1:8787)

Web Push trên Linux: dùng **Google Chrome** hoặc **Firefox**. Chromium/ungoogled/Brave thường báo `Registration failed - push service error` vì thiếu Google FCM. Brave: Settings → Privacy → bật *Use Google services for push messaging*.

## Production / VPS + Webinoly (`bac.codayroi.com`)

DNS: record **A** `bac.codayroi.com` → IP VPS. Webinoly đã cài sẵn. Trên Ubuntu (root):

Code app: `/var/www/bacpq` (Actions **tự clone** nếu chưa có). Repo phải **public**, hoặc trên VPS đã gắn deploy key để `git clone`/`pull` được.

Env: Secrets trên GitHub (`VAPID_*`, `VPS_*`) — không dùng `.env` trên VPS.

Cập nhật code: **push** `main` là đủ (GitHub Actions deploy). Chưa gắn Actions thì trên VPS:

```bash
sudo bash /var/www/bacpq/scripts/deploy.sh
```



### GitHub Actions (push `main` → build + deploy VPS)

Workflow: `.github/workflows/deploy-vps.yml` — CI `npm run build` trên GitHub, rồi SSH vào VPS chạy `deploy.sh`.

**1. SSH key (máy bạn hoặc GitHub):**

```bash
ssh-keygen -t ed25519 -C "github-actions-bacpq" -f ./bacpq-deploy -N ""
# public → VPS
ssh-copy-id -i ./bacpq-deploy.pub USER@VPS_IP
```

User SSH cần `sudo` không mật khẩu cho `deploy.sh` / `systemctl restart bacpq` (hoặc dùng `root`).

**2. Repo GitHub → Settings → Secrets and variables → Actions**


| Secret              | Ví dụ                                         |
| ------------------- | --------------------------------------------- |
| `VPS_HOST`          | IP VPS                                        |
| `VPS_USER`          | `root` hoặc user sudo                         |
| `VPS_SSH_KEY`       | private key `bacpq-deploy` (không passphrase) |
| `VPS_PORT`          | `22` (optional)                               |
| `VAPID_PUBLIC_KEY`  | từ `npx web-push generate-vapid-keys`         |
| `VAPID_PRIVATE_KEY` | cùng cặp                                      |
| `VAPID_SUBJECT`     | `mailto:you@example.com`                      |


Variables (optional): `PORT` (8787), `DATA_DIR` (`/var/lib/bacpq`), `POLL_MS` (2000).

Variable (optional): đổi path trên VPS thì sửa `cd /var/www/bacpq` trong workflow.

**3. Repo trên VPS phải** `git pull` **được** (public, hoặc [deploy key](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys) read-only nếu private).

Đổi branch: sửa `branches:` trong workflow (ví dụ `production`). `workflow_dispatch` cho phép bấm Deploy tay trên tab Actions.

- App: `127.0.0.1:8787` — Nginx reverse proxy + Let's Encrypt
- Subscriptions: `/var/lib/bacpq` (không xóa khi deploy)
- Log: `journalctl -u bacpq -f`

Example: bac.codayroi.com