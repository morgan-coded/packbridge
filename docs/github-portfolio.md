# PackBridge - Portfolio Brief

PackBridge is the Shopify B2B app I built for a very specific operations problem: a merchant sells in one unit, but the warehouse ships in another.

The app does not try to change checkout. It waits for the order, reads the B2B context, applies the merchant's pack rules, writes an audit trail, and sends a signed payload to whatever downstream system needs the normalized quantities.

That is the part I wanted to prove: not a pretty mockup, but the backend path that has to survive retries, odd rule precedence, CSV imports, and somebody asking "why did this order turn into three cases?"

## Resume / Upwork Summary

Built a Shopify B2B embedded app that normalizes post-order quantities into merchant-defined pack units, with Prisma/PostgreSQL persistence, CSV rule import, Shopify webhooks, HMAC-signed outbound delivery, and job-level audit history.

## What I Built

- A Shopify embedded app with OAuth, App Bridge, admin routes, and production deployment.
- A Prisma/Postgres data model for shops, synced Shopify entities, pack rules, jobs, events, and outbound deliveries.
- A rule resolver that handles company, location, product, and variant specificity instead of relying on one global rule.
- CSV import for pack rules, including validation errors a merchant can actually act on.
- An `orders/create` webhook path that records what happened before sending anything downstream.
- Signed outbound webhooks with delivery IDs and HMAC signatures.
- Launch/review assets: listing copy, screenshots, deployment notes, readiness docs, and video captions.

## The Interesting Parts

The core problem is precedence. A B2B merchant might have one rule for a company, another for a location, and another for a specific variant. PackBridge has to pick the right rule without making the admin UI impossible to understand.

The other hard part is trust. If a downstream system receives "2 cases" instead of "24 eaches," the merchant needs to know which rule fired, what Shopify order triggered it, and what payload was sent.

That is why the app keeps a job/event trail instead of treating the webhook as a fire-and-forget script.

## Good Files To Review

- `app/services/rule-resolver.server.ts`
- `app/services/normalizer.server.ts`
- `app/services/outbound.server.ts`
- `app/services/csv-importer.server.ts`
- `docs/screenshots/`
- `docs/app-store-readiness.md`
- `docs/deploy.md`

Rendered MP4 files are intentionally ignored so the repo stays light.

## How I Would Describe It In A Proposal

> PackBridge is a Shopify B2B app I built around pack-size normalization. Orders come in from Shopify, the app resolves the right pack rule, records the audit trail, and sends a signed payload to an ERP or warehouse system. It is a good example of the Shopify backend work I can do: embedded app routes, Prisma/Postgres, webhooks, CSV import, HMAC-signed integrations, and production deployment.

## Public-Readiness Notes

- Do not commit `.env`, Shopify secrets, database URLs, signing secrets, or generated Shopify CLI state.
- Keep real merchant/store data out of screenshots and docs.
- Keep the license proprietary/source-available unless Morgan decides otherwise.
- If making the GitHub repository public, run `PUBLICATION_CHECKLIST.md` first.
