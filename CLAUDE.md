# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Melotones (melotones.co) — a Next.js 14 App Router SaaS that generates personalized AI songs (occasion + style + message → a complete track) for African/diaspora users. Supabase (Postgres + Auth + Storage) is the only backend. Deployed on Vercel.

## Commands

```bash
npm run dev              # dev server
npm run build             # production build (also the fastest way to full-typecheck)
npx tsc --noEmit -p tsconfig.json   # typecheck only, faster than a full build
npm run start              # run a production build locally
vercel --prod              # deploy (this project deploys straight to production; there is no staging environment)
```

There is no lint script and no test framework configured. Treat `npx tsc --noEmit` + `npm run build` as the correctness bar before deploying, and verify behavior empirically against the real Supabase project (see below) rather than relying on unit tests.

`services/CreditService.js` and `lib/db/` are unused leftovers from the very first project scaffold — nothing imports them; ignore them rather than trying to wire them in.

## Architecture

### Data access: service-role only, everywhere

RLS on every table is either fully locked down (zero policies — service-role only) or filters rows, never columns. The app **never** grants `authenticated` broad read/write on sensitive tables (`user_credits`, `generations`, `purchase_requests`, `refund_requests`, `provider_*`). All reads and writes to these go through server code using `supabaseAdmin` (`lib/admin.ts`, service-role key), after the request has been authenticated with the cookie-based client (`lib/supabase/server.ts` → `createServerClientWithCookies()`). Business rules (balance checks, ownership, admin-only actions) live in the route handler, not in a policy. `requireAdmin()` in `lib/admin.ts` is the standard guard for every `/api/admin/**` route — every admin route calls it first.

When adding a new table or route: default to zero RLS policies + service-role access from a server route, not a policy granting the client direct access. This has been the source of a real production vulnerability once (a mis-scoped policy on `purchase_requests` let any user forge approved purchases) — don't reintroduce that shape.

### Money-safety patterns

Credit balance changes always use compare-and-swap, not read-then-write:
```ts
.update({ balance: creditRow.balance - 1 }).eq('user_id', userId).eq('balance', creditRow.balance)
```
This is the pattern in `app/api/generations/route.ts` (deduct), `lib/refunds.ts` (credit back), and `lib/purchaseApproval.ts` (credit on purchase approval, with a retry loop since two concurrent approvals for the same user can race). Never update a balance with a plain `.eq('user_id', ...)` — a lost update is a real money bug here.

Purchase approval (`lib/purchaseApproval.ts`) is shared by both the admin manual-approval route and the PayDunya webhook — don't duplicate that logic.

### Refunds: certain vs. uncertain failure

`lib/refunds.ts` has two paths, and the distinction matters:
- `autoRefund()` — an explicit, certain provider failure (MusicGPT returned a real error). Immediately approved and credited, no admin step.
- `requestRefundApproval()` — an ambiguous case (generation stuck "processing" for >15 min with no clear signal). Creates a pending `refund_requests` row an admin must approve in the dashboard.

`lib/song-processing.ts`'s `finalizeIfReady()` is the single place that decides which bucket a stalled/failed generation falls into, and it's called from both the MusicGPT webhook and the client-side polling route (`GET /api/generations/[id]`) — keep it idempotent (it already uses CAS on `generations.status`) if you touch it.

The admin account (`user_credits.is_admin = true`) never consumes or is charged Notes — every credit-deduction and payment path has an explicit `isAdmin` bypass. Don't remove those checks when refactoring.

### Music generation provider (MusicGPT)

`lib/music-generator.ts` is a thin dispatcher over `lib/music-providers/musicgpt.ts`; `generateMusic()` creates a prediction, `checkPrediction()` polls it. MusicGPT has **no balance/credits API and no language parameter** — language is baked into the natural-language prompt (`lib/promptBudget.ts`), and remaining balance is a manual estimate the admin enters (`provider_balance` table, `lib/providerBalance.ts`), which has been observed to drift significantly from MusicGPT's real balance. Because of that, `lib/providerErrors.ts`'s `isProviderOutOfCredits()` is the actual source of truth used to gate new generations: it checks for a real recent `INSUFFICIENT_CREDITS` error in `provider_errors`, not the estimate.

`music_style` sent to MusicGPT has a hard 300-character limit — `lib/promptBudget.ts` (`PROMPT_MAX_LENGTH = 295`) and `lib/styleDescriptors.ts` exist specifically to keep every style+occasion combination under that limit while leaving room for the user's own message; if you edit a style descriptor, re-check the worst-case message budget it leaves.

### Payments

`lib/payments/paydunya.ts` is the live, wired-in provider (Mobile Money + card for Sénégal); `lib/payments/cinetpay.ts` was built but is intentionally not called from `/api/payments/initiate` — leave it that way unless explicitly asked to add it as a second provider. `PAYDUNYA_MODE` env var (`live` vs anything else → sandbox) controls both the API base URL and the `PAYDUNYA-MODE` header; all 4 keys (`MASTER`, `PRIVATE`, `PUBLIC`, `TOKEN`) are required on every PayDunya request, confirmed against their PHP SDK source. The webhook (`app/api/webhooks/paydunya/route.ts`) never trusts the payload's claimed status — it always re-confirms via PayDunya's own `checkout-invoice/confirm` endpoint using our own stored `provider_token`, not whatever token the webhook body supplies, before crediting anything.

### The Next.js-serves-stale-data quirk (real, recurring)

Multiple routes reading recently-admin-modified tables have been observed serving stale data on Vercel despite `export const dynamic = 'force-dynamic'` — `supabase-js` internally uses `fetch()`, which Next.js can still cache. The fix used throughout the codebase (`app/api/pricing/route.ts`, `app/api/ads/route.ts`, `app/api/featured-song/route.ts`, `app/api/generate-lyrics/route.ts`) is a raw `fetch()` straight to PostgREST with `cache: 'no-store'`, not `supabaseAdmin.from(...)`. Use this pattern for any new public GET route that reads data an admin can change (pricing, ads, featured content), rather than supabase-js.

### Styles, occasions, translations

`lib/styleMeta.ts` / `lib/occasionMeta.ts` / `lib/listTranslations.ts` are the canonical lists of musical styles and occasions (emoji + fr/en labels) — the create flow, chatbot system prompt, admin pricing display, and sitemap-adjacent song metadata all read from these rather than hardcoding style names, so add new styles/occasions there once.

### App shell / routing

`components/AppShell.tsx` picks the layout by pathname prefix, not by route group: `APP_SHELL_PREFIXES` (dashboard/create/explore/history/shorts/statistiques/notes/profil/songs) get the authenticated Sidebar+chat layout, `BARE_PREFIXES` (login/signup) get no chrome, everything else (privacy, terms, and `/` if ever re-enabled as a public page) gets the public Navbar+Footer. Adding a new page means adding its prefix to the right list here, not just creating the route.

`middleware.ts` 308-redirects any non-canonical hostname to `melotones.co` (protects against Vercel's auto-recreated preview aliases) — note this does **not** fully fix a Google OAuth flow started on the wrong hostname, since the PKCE code-verifier cookie is scoped to whatever domain initiated `signInWithOAuth`.

### i18n

No i18n library — `useLanguage()` (`contexts/LanguageContext.tsx`) provides a `t(fr, en)` function used inline at every string. Keep that pattern rather than introducing a translation-file system.

### Empirical testing pattern

For anything auth-gated, the established way to test a change against production (there's no staging) is: create a throwaway Supabase user via `supabaseAdmin.auth.admin.createUser()`, get a session via `admin.auth.admin.generateLink({type:'magiclink'})` + `POST /auth/v1/verify`, feed that session into a `createServerClient` from `@supabase/ssr` with an in-memory cookie jar to capture the real `sb-*-auth-token` cookie Next.js expects, then `fetch()` the route with that cookie header. Password-grant sign-in (`grant_type=password`) is blocked by Turnstile captcha even with the service-role key, so don't try that route. Always delete the throwaway user (and any rows it created) afterward.
