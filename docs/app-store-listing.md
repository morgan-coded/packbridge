# PackBridge — Shopify App Store listing copy

Ready-to-paste content for the Shopify Partner Dashboard. Keep this file in
sync with the submitted listing.

---

## App name

PackBridge

## Tagline (80 chars max)

Translate B2B orders into ERP-safe pack units automatically

_(71 characters)_

## Category

Orders and fulfillment

---

## Description

**Stop cleaning up wholesale orders by hand.**

PackBridge translates valid Shopify B2B orders into downstream-safe pack units for your ERP, EDI, warehouse, or ops workflows.

Shopify enforces quantity rules — minimums, maximums, increments. But when a buyer orders 100 each and your ERP expects 2 cases, that's a translation problem Shopify doesn't solve.

PackBridge does.

**How it works:**

- Define pack rules by company, location, product, or variant
- Import rules in bulk via CSV
- When a B2B order is created, PackBridge automatically resolves the matching rule
- Validates divisibility against your pack size
- Translates quantities into downstream-safe units (CASE, INNER, PALLET, CTN)
- Delivers a signed JSON payload to your configured webhook endpoint
- Logs every translation with a full audit trail

**Built for:**

- Industrial suppliers
- Food and beverage distributors
- Janitorial and facility supply companies
- Medical distributors
- Manufacturers with case-pack or pallet rules
- Any B2B merchant who sells in one unit and fulfills in another

**What PackBridge is not:**
PackBridge is not a WMS, an ERP connector, a bundle app, or a checkout enforcement tool. It does one thing: translate valid B2B orders into downstream-safe pack units.

**Features:**

- Customer-specific pack rules with priority resolution
- CSV bulk import for fast setup
- Three enforcement modes: warn, hold, normalize-only
- Signed webhook delivery with HMAC verification
- Full audit trail for every order processed
- Clean admin UI built on Shopify Polaris

---

## Key benefits (3 bullet points for listing)

1. Eliminate manual order cleanup between Shopify and your ERP
2. Customer-specific pack rules resolve automatically on every B2B order
3. Signed webhook payloads integrate with any downstream system

---

## Pricing

- **Plan:** PackBridge Monthly
- **Price:** $99.00 USD / 30 days
- **Free trial:** 14 days

---

## Permissions requested (scopes)

- `read_orders` — read B2B order line items and quantities after order creation
- `read_products` — mirror products and variants so merchants can assign pack rules by SKU
- `read_companies` — mirror B2B companies and locations for company-specific pack rules
- `read_customers` — read the purchasing entity on B2B orders so PackBridge can resolve the correct company/location context

No write scopes. PackBridge does not modify shop data.

---

## Supported surfaces

- Shopify Admin (embedded app)
- Webhook delivery to merchant-configured HTTPS endpoints

_Not used:_ Online Store, Checkout, Storefront API, Shopify Functions, POS.

---

## Screenshots to upload

In this order:

1. `docs/screenshots/01-dashboard.png` — Dashboard, quick stats, and recent jobs
2. `docs/screenshots/02-pack-rules.png` — Rules list with mixed scopes and enforcement modes
3. `docs/screenshots/03-rule-form.png` — Create rule form with company, location, and SKU selected
4. `docs/screenshots/04-csv-import.png` — CSV import completion and import history
5. `docs/screenshots/05-jobs-list.png` — Jobs list with completed, held, and mixed statuses
6. `docs/screenshots/06-job-detail.png` — Job detail with event timeline and redacted delivery URL
7. `docs/screenshots/07-settings.png` — Settings with placeholder webhook URL and masked signing secret

Additional assets:

- `docs/screenshots/feature-1600x900.png` — feature banner
- `docs/screenshots/icon-1200.png` — placeholder app icon; replace if final brand artwork differs

---

## Support

- **Support email:** support@packbridge.app
- **Privacy policy:** https://packbridge.app/privacy.html
- **Documentation:** https://packbridge.app/docs _(to be added)_
