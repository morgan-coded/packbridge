# App Store Readiness Checklist

Status as of 2026-04-28. This is a readiness checklist only; PackBridge has not been submitted.

Official sources checked:

- Shopify App Store requirements: https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements
- Shopify App Store best practices: https://shopify.dev/docs/apps/launch/shopify-app-store/best-practices
- Submit your app for review: https://shopify.dev/docs/apps/launch/app-store-review/submit-app-for-review
- Pass app review: https://shopify.dev/docs/apps/launch/app-store-review/pass-app-review
- Privacy law compliance: https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance

The requested Shopify Dev MCP tool was not available in this Codex session, so this checklist uses the current official Shopify docs above.

## Done

- App listing draft exists in `docs/app-store-listing.md`.
- Pricing copy is isolated to the Pricing section: PackBridge Monthly, $99 USD every 30 days, 14-day free trial.
- Scope list is least-privilege: `read_orders`, `read_products`, `read_companies`, `read_customers`.
- Scope justification copy is present for all requested scopes.
- Embedded app uses Shopify Admin UI and GraphQL Admin API paths; no REST Admin API usage was found in app code.
- GDPR routes exist for `customers/data_request`, `customers/redact`, and `shop/redact`.
- `shopify.app.toml` declares mandatory compliance webhook subscriptions.
- `shop/redact` now purges shop-scoped PackBridge data instead of logging a no-op.
- `public/privacy.html` exists.
- `docker build .` passes locally with Docker Engine 29.4.1 / Colima on macOS arm64.
- Dev-store E2E validation passed for sync, UI rule create, CSV import, real B2B orders, HMAC-signed outbound payloads, Jobs UI, all three enforcement modes, non-divisible validation, and retry.
- Demo seed data exists for `stocklockb.myshopify.com` via `npm run seed:demo`.
- App Store screenshot assets exist in `docs/screenshots/`: seven 1600 x 900 PNGs, one 1600 x 900 feature banner, and one 1200 x 1200 placeholder icon.

## Needs User Input

- App icon: replace `docs/screenshots/icon-1200.png` if final brand artwork differs from the placeholder PackBridge mark.
- Demo screencast: English or English-subtitled walkthrough showing onboarding and the core setup flow.
- Demo store URL and reviewer testing instructions.
- Support email: confirm `support@packbridge.app` exists and is monitored.
- Documentation URL: `https://packbridge.app/docs` is listed as "to be added"; provide or remove before submission.
- Privacy URL: confirm production serves `https://packbridge.app/privacy.html`.
- Partner Dashboard contact email: add `app-submissions@shopify.com` and `noreply@shopify.com` to allowed senders.
- Protected customer data access: confirm whether Shopify requires an access request for `read_customers`; if so, submit the request with the purchasing-entity justification.

## Needs Final Verification

- Production host URL and Shopify Partner app URL are not set yet.
- Billing must be tested once deployed with `NODE_ENV=production` so production charges are not accidentally created as test charges.
- OAuth install/reinstall flow must be tested against the production host and redirect URLs.
- App Bridge script placement should be rechecked in production. Shopify requires the latest App Bridge; PackBridge currently loads `app-bridge.js` after hydration to avoid embedded preview crashes.
- Confirm the App Store listing images contain no pricing, testimonials, stats, Shopify trademarks, browser chrome, desktop backgrounds, duplicate screenshots, or logo-only screenshots.

## Reviewer Notes To Prepare

- PackBridge is not a sales channel, payment app, purchase-option app, POS app, checkout extension, or online-store theme app.
- PackBridge is read-only and does not modify shop data.
- PackBridge processes only post-order B2B normalization and sends signed webhook payloads to the merchant-configured endpoint.
- Suggested test path: install app, confirm initial sync, create one pack rule, import one CSV rule, set webhook endpoint, create a B2B order, verify Jobs detail and signed outbound payload.
