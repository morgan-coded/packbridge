# PackBridge

Translate B2B orders into downstream-safe pack units — each → inner → case → pallet — and deliver signed payloads to your ERP, EDI, or warehouse system.

PackBridge is a backend-first Shopify embedded app. It does **not** enforce quantity rules at checkout. It processes orders **after** creation, resolving merchant-defined pack rules and delivering normalized quantities via signed webhook payloads.

## How it works

1. Merchant installs the app. PackBridge syncs companies, locations, and product variants.
2. Merchant defines pack rules — scoped by company, location, product, or variant — via the admin UI or CSV import.
3. A B2B order arrives via Shopify's `orders/create` webhook.
4. PackBridge resolves the most specific matching rule for each line item, validates divisibility, and translates `input_quantity` → `output_quantity` in the downstream unit (CASE, INNER, PALLET, etc.).
5. A signed JSON payload is POSTed to the merchant's configured webhook endpoint.
6. Every step is logged in a full audit trail visible in the Jobs admin.

## Architecture

```
Shopify webhook (orders/create)
  → authenticate + extract B2B context
  → normalizer: resolve rules, validate line items, record events
  → outbound: assemble payload, HMAC sign, POST with retry
  → OutboundDelivery audit row
```

**Stack:** React Router v7 · TypeScript · Prisma 6 · PostgreSQL · Shopify Admin GraphQL API · Polaris web components

## Project structure

```
app/
  components/         Shared React components (RuleForm)
  lib/                Pure helpers (GID conversion)
  routes/
    app._index.tsx    Dashboard
    app.rules.*       Rules CRUD + CSV import
    app.jobs.*        Normalization jobs list + detail
    app.settings.tsx  Webhook URL, signing secret, defaults
    app.tsx           Layout + billing gate + nav
    auth.*            Shopify OAuth
    webhooks.*        Webhook handlers (orders/create, compliance, etc.)
  services/
    billing.server.ts       Subscription check + gate
    csv-importer.server.ts  CSV parse, validate, execute import
    normalizer.server.ts    Order → events pipeline
    orders.server.ts        GraphQL order fetch with B2B context
    outbound.server.ts      Payload build, HMAC sign, POST + retry
    rule-resolver.server.ts Score, resolve, validate line items
    shop-settings.server.ts Signing secret bootstrap + rotate
    sync.server.ts          Company/variant/shop sync from Admin API
  shopify.server.ts         App config, billing plan, afterAuth hook
  db.server.ts              Prisma client singleton

prisma/
  schema.prisma             10 models (Session, Shop, Synced*, PackRule,
                            NormalizationJob/Event, OutboundDelivery,
                            RuleImportJob)
  migrations/               2 migrations (init + phase 3 fields)

docs/
  app-store-listing.md      App Store submission copy

public/
  privacy.html              Privacy policy
```

## Getting started

### Prerequisites

- Node.js >= 20.19
- PostgreSQL database
- [Shopify CLI](https://shopify.dev/docs/apps/tools/cli)

### Setup

```bash
# Clone and install
git clone https://github.com/morgan-coded/packbridge.git
cd packbridge
npm install

# Configure environment
cp .env.example .env
# Fill in: SHOPIFY_API_KEY, SHOPIFY_API_SECRET, DATABASE_URL, SHOPIFY_APP_URL

# Run migrations and generate Prisma client
npm run setup

# Start development
npx shopify app dev --tunnel-url https://your-tunnel-url:8080
```

### Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start dev server via Shopify CLI |
| `npm run build` | Production build |
| `npm run setup` | Generate Prisma client + run migrations |
| `npm test` | Run Vitest |
| `npm run test:watch` | Vitest in watch mode |
| `npm run typecheck` | TypeScript type check |
| `npm run lint` | ESLint |

## Scopes

PackBridge is read-only:

- `read_orders` — process B2B orders
- `read_products` — mirror variants for pack rules
- `read_companies` — resolve company-scoped rules
- `read_customers` — read purchasing entity on B2B orders

No write scopes.

## Billing

$99/month with a 14-day free trial. Billing is gated at the app layout level in production — every `/app/*` page checks for an active subscription before rendering.

Local/dev environments skip the billing gate so embedded previews work before public distribution. Set `NODE_ENV=production` on the production host to enforce billing. During pre-launch App Store review or dev-store validation, set `SHOPIFY_BILLING_TEST=true` so the production app still requires billing but requests Shopify test charges.

## Pack rule resolution

Rules are resolved with a most-specific-wins strategy:

| Priority | Scope | Score |
|---|---|---|
| 1 | Company + location + variant | 8 |
| 2 | Company + variant | 6 |
| 3 | Company + location + product | 7 |
| 4 | Company + product | 5 |
| 5 | Company only | 4 |
| 6 | Global variant | 2 |
| 7 | Global product | 1 |

Ties are broken by `updatedAt` descending. Rules respect `active`, `effectiveStart`, and `effectiveEnd`.

### Enforcement modes

- **warn** — order proceeds, flagged for review
- **hold** — order held from downstream release until reviewed
- **normalize_only** — translation emitted with warnings if not divisible

## Outbound delivery

When a B2B order is normalized, PackBridge POSTs a signed JSON payload:

**Headers:**
- `Content-Type: application/json`
- `X-PackBridge-Signature: sha256=<HMAC hex digest>`
- `X-PackBridge-Delivery-Id: <delivery cuid>`

**Signature verification** (example in Node.js):

```js
const crypto = require('crypto');

function verify(body, signature, secret) {
  const expected = 'sha256=' +
    crypto.createHmac('sha256', secret).update(body).digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}
```

The signing secret is visible in the app's Settings page. Retries: up to 3 attempts at 1s, 5s, 15s intervals.

## Tests

37 tests across 4 files:

- **rule-resolver.test.ts** (21) — priority ordering, date filtering, active flag, validateLineItem
- **normalizer.test.ts** (5) — computeOverallStatus (hold/completed/mixed/empty)
- **outbound.test.ts** (6) — HMAC signing, payload hashing, determinism
- **form-values.test.ts** (5) — Shopify form-value normalization and rule scoping

```bash
npm test
```

## Deployment

1. Set `NODE_ENV=production` on your host
2. Set `DATABASE_URL` to your production PostgreSQL connection string
3. Set `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_APP_URL`
4. Run `npm run setup` to apply migrations
5. Run `npm run build && npm start`

See [docs/deploy.md](docs/deploy.md) for the PackBridge runbook and the [Shopify deployment docs](https://shopify.dev/docs/apps/launch/deployment) for hosting options.

## License

Proprietary. All rights reserved.
