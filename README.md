# DomainHunter

An automated expired domain hunting and acquisition engine built with Next.js 14, Prisma, Supabase, and the Namecheap API.

## Features

- 🔍 **Automated Scanning** — Pulls from ExpiredDomains.net + Namecheap Marketplace every 6 hours via Vercel crons
- 📊 **Composite Scoring** — Wayback Machine snapshots + DataForSEO backlinks + Majestic TF/CF + Domain Age + Niche match
- 🛒 **Auto-Buyer** — Purchase queue with Namecheap XML API, 30s delay between purchases, daily caps
- ☁️ **Cloudflare Auto-Setup** — Automatically creates DNS zone after purchase
- 📧 **Email Alerts** — Resend HTML email on every successful purchase
- 📈 **Analytics Dashboard** — Recharts visualizations for velocity, score distribution, niche spread
- 🔒 **Auth** — Cookie-based admin login at `/login`
- 🛑 **Kill Switch** — Pause all purchases instantly from dashboard

## Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/your-org/domainantigravity.git
cd domainantigravity
npm install
```

### 2. Environment Variables

```bash
cp .env.example .env
```

Fill in all values — see [Environment Variables](#environment-variables) below.

### 3. Database Migration

```bash
npx prisma migrate dev --name init
npx prisma db seed
```

### 4. Run Dev Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with your `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

### 5. Configure API Keys

Go to `/settings` and enter:
- Namecheap API credentials (sandbox mode for testing)
- DataForSEO email + password
- Cloudflare API token (Zone:Edit permission)
- Resend API key
- Majestic API key (optional — leave blank for free tier)
- Buy threshold + daily budget

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | Supabase PostgreSQL connection string |
| `ENCRYPTION_KEY` | ✅ | 32-character string for encrypting stored API keys |
| `CRON_SECRET` | ✅ | Random secret to authenticate cron job requests |
| `ADMIN_EMAIL` | ✅ | Admin login email |
| `ADMIN_PASSWORD` | ✅ | Admin login password |
| `NEXT_PUBLIC_APP_URL` | ✅ | Your deployed URL (e.g. `https://your-app.vercel.app`) |
| `MAJESTIC_API_KEY` | ❌ | Majestic API key — leave blank to use free tier |

---

## Running Crons Manually

Each cron is a standard GET endpoint protected by `x-cron-secret`:

```bash
# Trigger domain scan
curl -H "x-cron-secret: YOUR_CRON_SECRET" https://your-app.vercel.app/api/cron/scan

# Trigger scoring of PENDING domains
curl -H "x-cron-secret: YOUR_CRON_SECRET" https://your-app.vercel.app/api/cron/score

# Drain purchase queue
curl -H "x-cron-secret: YOUR_CRON_SECRET" https://your-app.vercel.app/api/cron/queue
```

Cron schedules (configured in `vercel.json`):
- `/api/cron/scan` — every 6 hours
- `/api/cron/score` — every 30 minutes
- `/api/cron/queue` — every 5 minutes

> **Note:** Vercel Crons require a Pro plan or higher.

---

## Kill Switch

To immediately pause all domain purchases:

1. **Dashboard UI** — Click the red "Kill Switch" button in the System Status panel
2. **API** — `POST /api/purchase/killswitch` with `{ "active": true }`

The dashboard shows a pulsing red badge and "HUNTING PAUSED" when active.

To resume: click the button again or POST `{ "active": false }`.

---

## Architecture

```
Cron/scan (6h)
  → ExpiredDomains.net + Namecheap Marketplace
  → Save as PENDING to DB
  → Log to ScanRun table

Cron/score (30m)
  → Fetch PENDING domains
  → filter → wayback → dataforseo → majestic → scorer
  → Update status: QUEUED (≥ threshold) or REJECTED
  
Cron/queue (5m)
  → Fetch QUEUED domains, highest score first
  → Namecheap purchase API
  → On success: Cloudflare zone + Resend email
  → Update status: BOUGHT or FAILED

/hunt (manual)
  → Same pipeline, triggered by user
  → Results appear in /domains immediately

/domains  ← GET /api/domains ← DB
/dashboard ← GET /api/dashboard/stats + /api/dashboard/status
/analytics ← GET /api/analytics/stats
```

---

## Deploy to Vercel

1. Push to GitHub
2. Import project at [vercel.com/new](https://vercel.com/new)
3. Add all environment variables from `.env.example`
4. Deploy — crons auto-register from `vercel.json`

---

## Verification

Hit `/api/test-full-pipeline` to run the complete pipeline on 5 test domains and verify all scoring fields are returned correctly.

## License

MIT
