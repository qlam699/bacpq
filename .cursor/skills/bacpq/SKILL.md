---
name: bacpq
description: >-
  Architecture and conventions for the bacpq Phú Quý silver price tracker
  (React+Vite SPA, Express SSE/poller/Web Push, GitHub Actions→VPS artifact
  deploy). Use when working in the bacpq repo, changing prices/history/push/
  settings/deploy, or when an agent needs project context without reading all files.
---

# bacpq — Agent Handoff

## What this is

Vietnamese **Bạc Phú Quý** price tracker: live CTJ prices (SSE), history chart, positions/P&L, Web Push on **BPQ1L** changes. Prod: `https://bac.codayroi.com`.

**Invariant:** SPA talks only to `/api/*`. Only the Node server calls CTJ / Phú Quý.

## Stack

| Layer | Tech |
|-------|------|
| SPA | React 19, Vite 5, Chart.js, `src/` |
| API | Express 5, `server/src/`, `node server/dist/index.js` |
| Client storage | `localStorage` + optional GitHub Gist (PAT `gist`) |
| Server storage | `$DATA_DIR/subscriptions.json` |
| Deploy | GHA build tarball → SCP → wipe `/var/www/bacpq` → extract → systemd |

Dev: `npm run dev` → Vite `:5173` (proxies `/api`) + server `:8787`.

## Where to edit

| Task | Start here |
|------|------------|
| UI / charts / settings | `src/components/`, `src/App.css` |
| Client data hooks | `src/hooks/` |
| API clients, format, storage keys | `src/lib/` |
| Routes, poller, push, history | `server/src/` |
| Service worker push | `public/sw.js` |
| Deploy | `.github/workflows/deploy-vps.yml`, `scripts/deploy.sh` |
| First-time VPS | `scripts/setup-vps-webinoly.sh`, `deploy/bacpq.service` |

**Leave alone unless asked:** `deploy/nginx-*.conf` (Webinoly owns live nginx), deploy keys, `node_modules/`, build outputs.

## Domain rules

- **Product IDs:** `BPQ1L` \| `BPQ10L` \| `BPQ1KG` — duplicated in `src/lib/ctj.ts` and `server/src/ctj.ts` (keep in sync).
- **Web Push product:** **BPQ1L only** (server + client).
- **History `type`:** `1` = Lượng, `3` = KG (not CTJ IDs). Query XOR: `duration` **or** `fromDate`+`toDate` (`dd/MM/yyyy`).
- **Poll window:** 08:30–18:30 `Asia/Ho_Chi_Minh` (`server/src/vnTime.ts`). Interval = server `POLL_MS` (not `Settings.pollMs`).
- **UI language:** Vietnamese.
- **Money inputs:** thousand dots via `formatDigitGroups` / `parseGroupedInt` in `src/lib/format.ts`.

## Storage keys (client)

| Key | Data |
|-----|------|
| `bacpq:positions` | Positions |
| `bacpq:setting` | Settings (**singular** — do not rename) |
| `bacpq:gh_token` / `bacpq:gh_user` / `bacpq:gist_id` | GitHub |

Gist files when logged in: `positions.json`, `settings.json`.

## Env (server / `/etc/bacpq.env`)

`PORT` (8787), `POLL_MS` (2000), `DATA_DIR` (`/var/lib/bacpq` prod), `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.

No `.env` file on VPS — Actions secrets write `/etc/bacpq.env`.

## Deploy (do not reintroduce VPS build)

1. GHA: `npm ci` → `build` → `npm ci --omit=dev` → `bacpq-release.tar.gz`
2. SCP → `/tmp` → `deploy.sh --release` → **stop → `rm -rf /var/www/bacpq` → extract → env → restart → health**
3. **Never wipe** `/var/lib/bacpq` (push subscriptions)

## API map

`/api/health` · `/api/prices` · `/api/prices/stream` (SSE) · `/api/history` · `/api/vapid-public-key` · `/api/push/subscribe|unsubscribe` · then SPA from `dist/`.

## Gotchas

1. Dual notify: server push + local `usePriceNotify` — avoid double-fire when push sub exists.
2. Linux Chromium/Brave often break FCM; prefer Chrome/Firefox.
3. SSE: `X-Accel-Buffering: no`; client reconnect ~3s.
4. Threshold settings: `minBuy` (top) must be **>** `maxSell` (bottom) when both set; UI warns in `SettingsPopup`.

## Deeper detail

See [architecture.md](architecture.md) for flows, directory tree, and touch/leave matrix.
