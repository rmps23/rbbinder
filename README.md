# RBBinder

A collection manager for the **Riftbound** trading card game: organise your cards in virtual binders, scan cards with your phone camera, check market prices and build legal decks from the cards you actually own.

Personal, unofficial project. Card data and images © Riot Games.

## Features

- **Binders** – create as many binders as you like, each with its own page layout (2×2, 3×3, 3×4 or 4×4) and copy count per card. Page-flip view on desktop, one-page-at-a-time swipe view on phones.
- **Bulk** – a separate pile for duplicates and trade cards, with a one-click copy of the list.
- **Card scanner** – point the camera at a card and it's recognised from its artwork (frame-voting match), with OCR of the collector code (Tesseract.js) as a fallback.
- **Deck builder** – follows Riftbound's deck rules (39 cards + champion), checks champion eligibility and shows power/rune stats.
- **Meta decks** – pick a legend and see, for each recent list from Riot's official Top Decks, how many cards you still need (bulk + binders).
- **Prices** – Cardmarket prices with a switchable basis (trend, 7-day average or lowest listing), plus a "wants" export ready for Cardmarket.
- **Set progress** – a binder can track a full set and show how many regular cards are still missing.
- **Catalog sync** – card data comes from the official site and is stored in Supabase; a "Sync cards" button pulls in new sets without a redeploy.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS · Supabase (Postgres) · Tesseract.js · Vercel

## How it's built

- All data access goes through Next.js API routes (`src/app/api`), so the Supabase service-role key never reaches the browser.
- The whole site sits behind a single password gate (`src/proxy.ts`) because it's deployed on a public URL.
- Without Supabase credentials the app falls back to a local JSON file (`.data/local-db.json`), so it can be run and tested with no database.

## Running locally

```bash
cp .env.example .env.local   # set SITE_PASSWORD and SESSION_SECRET
npm install
npm run dev
```

Open http://localhost:3000, log in with `SITE_PASSWORD` and click **Sync cards** to load the catalog.

To use Supabase instead of the local file, create a project, run [`supabase/schema.sql`](supabase/schema.sql) in the SQL editor, and add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to `.env.local`. The same four variables are all that's needed to deploy on Vercel.
