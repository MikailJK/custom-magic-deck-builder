# The Drafting Table

A collaborative custom Magic: the Gathering deck/cube builder — card pool with
images and metadata, filtering/search, and deck & cube construction with a
mana curve and color balance, plus OCR auto-fill when adding a card.

Stack: React + Vite (frontend), Supabase (Postgres database + auth),
Cloudflare R2 (image storage), deployed on Vercel.

## 1. Create your Supabase project

1. Go to [supabase.com](https://supabase.com), create a free account and a new project.
2. In the SQL Editor, run the contents of `supabase/schema.sql` once. This creates
   the `cards`, `decks`, and `deck_cards` tables with Row Level Security enabled.
   If your project predates a migration in `supabase/migrations/`, run those too,
   in filename order — they are idempotent, so re-running one is harmless.
3. In **Settings > API**, copy your **Project URL** and **anon public key** —
   you'll need these for `.env`.
4. In **Authentication > Providers**, email/password sign-up is on by default.
   If you'd rather hand-pick who gets in instead of open sign-up, go to
   **Authentication > Settings** and turn off "Allow new users to sign up"
   once your friend group has accounts, or add them directly from
   **Authentication > Users > Add user**.

## 2. Create your Cloudflare R2 bucket

1. In the Cloudflare dashboard, go to **R2 Object Storage** and create a bucket
   (e.g. `drafting-table-images`).
2. Open the bucket's **Settings** tab and turn on **Public Development URL** —
   this gives you a free `https://pub-xxxxxxxx.r2.dev` URL to serve images from.
   Copy it for `.env`.
3. Under the bucket's **Settings > CORS Policy**, add a policy allowing your
   app's origin(s) to upload directly:
   ```json
   [
     {
       "AllowedOrigins": ["http://localhost:5173", "https://your-app.vercel.app"],
       "AllowedMethods": ["PUT"],
       "AllowedHeaders": ["Content-Type"]
     }
   ]
   ```
   Add your real Vercel URL once you have it (step 4), and update this
   whenever you add a custom domain.
4. Go to **R2 > Manage API Tokens** and create a token with **Object Read &
   Write** permission scoped to this bucket. Note the **Access Key ID**,
   **Secret Access Key**, and your **Account ID** (shown on the R2 overview page).

## 3. Configure environment variables

Copy `.env.example` to `.env` and fill in the values from steps 1–2:

```
cp .env.example .env
```

## 4. Run it locally

```
npm install
npm run dev
```

Open the printed local URL, create an account (this is real Supabase auth —
whoever signs up gets an account), and start adding cards.

Note: the `/api/r2-upload-url` serverless function only runs when deployed
on Vercel (or via `vercel dev` locally, see below) — plain `vite dev` won't
serve it, so image uploads will fail with a 404 until you either deploy or
use the Vercel CLI locally:

```
npm install -g vercel
vercel dev
```

## 5. Deploy to Vercel

1. Push this project to a GitHub repository.
2. In [vercel.com](https://vercel.com), import the repository. Vercel
   auto-detects the Vite framework.
3. In the project's **Settings > Environment Variables**, add all the
   variables from your `.env` file (both the `VITE_*` ones and the R2 ones —
   Vercel needs the R2 ones to run `api/r2-upload-url.js` server-side).
4. Deploy. Once you have your `*.vercel.app` URL, add it to the R2 CORS
   policy from step 2 if you haven't already, and to Supabase's
   **Authentication > URL Configuration > Redirect URLs** if you turn on
   email confirmation links.

## How it fits together

- **Cards & decks** live in Supabase Postgres (`supabase/schema.sql`). Row
  Level Security requires a signed-in user for any read or write — the
  "who's allowed in" boundary is having an account, which you control via
  Supabase's sign-up settings.
- **Images** upload straight from the browser to R2 using a short-lived
  presigned URL, minted by `api/r2-upload-url.js` after verifying the
  request carries a valid Supabase session. Your R2 credentials never reach
  the browser.
- **OCR auto-fill** (`src/lib/ocr.js`) runs entirely client-side via
  Tesseract.js, cropping the uploaded image into the name/type-line/rules-text/
  power-toughness regions of a standard card layout before reading each one —
  much more accurate than reading the whole card at once. Mana cost and
  colors are left for manual entry, since those are usually icon symbols
  rather than text.

## Known limitations, honestly

- OCR accuracy depends on how closely a card's layout matches the classic
  black-bordered template; wildly different homebrew layouts will read worse.
- There's no per-row ownership — anyone with an account can edit or delete
  any card or deck. That matches "shared with my friend group," but isn't a
  fit if you ever want individual permissions.
- No image moderation/limits beyond what you enforce socially — anyone with
  an account can upload to your R2 bucket via the app.
