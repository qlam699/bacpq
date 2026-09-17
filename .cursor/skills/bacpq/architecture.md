# bacpq architecture (reference)

Read this when you need more than the skill summary.

## Directory tree

```
bacpq/
├── .github/workflows/deploy-vps.yml
├── .cursor/skills/bacpq/          # this skill
├── deploy/
│   ├── bacpq.service              # systemd template (__APP_DIR__)
│   ├── env.example                # secrets/vars schema docs
│   └── nginx-*.conf               # reference only
├── scripts/
│   ├── deploy.sh                  # --release: wipe + extract + env + restart
│   └── setup-vps-webinoly.sh      # first-time Node/user/unit/Webinoly
├── public/sw.js
├── src/
│   ├── App.tsx                    # composition root
│   ├── components/                # PriceHeader, PriceChart, HistoryChart,
│   │                              # PositionForm/Table, SettingsPopup, Github*
│   ├── hooks/                     # usePriceStream, usePriceNotify, usePositions,
│   │                              # useSettings, useGithubAuth, useHistoryPrices
│   └── lib/                       # ctj, pricesApi, historyApi, notify, storage,
│                                  # gist*, githubAuth, format, pnl, weekdayStats
└── server/src/
    ├── index.ts                   # Express + static SPA
    ├── poller.ts / ctj.ts / sse.ts
    ├── phuquyHistory.ts
    ├── push.ts / subscriptions.ts
    └── vnTime.ts
```

VPS: `/var/www/bacpq` (wiped each deploy) · `/var/lib/bacpq` (kept) · `/etc/bacpq.env`

## Live prices

```
poller → CTJ /today (per productId)
      → cache Map<ProductId, CtjTick[]>
      → fingerprint change → SSE broadcastSnapshot
SPA EventSource /api/prices/stream?productId=…
```

Outside 08:30–18:30 VN: one fetch for cache, then wait until window opens.

## History

`HistoryChart` → `GET /api/history` → Phú Quý `statistics-price/2` → normalize BAC points → ~90s memory cache.

## Web Push

1. Settings enable → SW + `PushManager.subscribe` → `POST /api/push/subscribe` (**BPQ1L**).
2. Poller: BPQ1L buy/sell fingerprint change → optional threshold filter → `web-push`.
3. Subs in `$DATA_DIR/subscriptions.json`; 404/410 → remove.
4. Local tab notify only when no push subscription (see `usePriceNotify` / `notify.ts`).

Thresholds (OR): shop buy ≥ `minBuy` **or** shop sell ≤ `maxSell`, if `thresholdEnabled`.

## Settings / Gist

| Data | localStorage | Gist |
|------|--------------|------|
| Positions | `bacpq:positions` | `positions.json` |
| Settings | `bacpq:setting` | `settings.json` |

Logged-in Gist is source of truth; local is mirror. No merge — last PATCH wins.

## Deploy pipeline

```
push main / workflow_dispatch
  → npm ci && npm run build && npm ci --omit=dev
  → tar: dist, server/dist, node_modules, package*.json, deploy, scripts
  → artifact bacpq-release → scp /tmp/bacpq-release.tar.gz
  → if no systemd unit: seed + setup-vps-webinoly.sh
  → deploy.sh --release (wipe APP_DIR, extract, /etc/bacpq.env, restart)
  → curl /api/health
```

Secrets: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VAPID_*`.  
Vars: `PORT`, `DATA_DIR`, `POLL_MS`.

**Do not** add `git pull` or `npm run build` on the VPS again.

## Touch vs leave

**Touch freely:** `src/**`, `server/src/**`, `public/sw.js`, READMEs for user-facing flow changes.

**Touch carefully:** deploy workflow/scripts/unit; product ID lists; push allowlist; poll window.

**Leave alone:** live nginx (Webinoly), gitignored deploy keys, `node_modules`, `dist`, `server/dist`, `data/`.

## Local checklist

```bash
npm install && npm run dev
# optional: npx web-push generate-vapid-keys → export VAPID_*
curl -s localhost:8787/api/health
```
