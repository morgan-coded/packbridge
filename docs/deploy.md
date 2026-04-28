# Deploy Runbook

This runbook prepares PackBridge for a production host. Do not run `shopify app deploy`, push new URLs in Partners, or submit the App Store listing until the production host and secrets are ready.

## 1. Provision Postgres

Create a managed PostgreSQL database and keep the connection string private. The app expects a standard Prisma `DATABASE_URL`, for example:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require"
```

Run migrations from the production release after the database exists:

```bash
npm run setup
```

## 2. Set Environment Variables

Required:

```bash
NODE_ENV=production
SHOPIFY_API_KEY=...
SHOPIFY_API_SECRET=...
SHOPIFY_APP_URL=https://your-production-host.example.com
DATABASE_URL=postgresql://...
```

Optional:

```bash
SCOPES=read_orders,read_products,read_companies,read_customers
SHOP_CUSTOM_DOMAIN=shop.example.com
```

If `SCOPES` is omitted, Shopify uses the scopes from `shopify.app.toml`. Leave `SHOP_CUSTOM_DOMAIN` unset unless the merchant uses a custom shop domain.

## 3. Build And Start

For a Node host:

```bash
npm ci
npm run setup
npm run build
npm start
```

For Docker:

```bash
docker build -t packbridge .
docker run --env-file .env -p 3000:3000 packbridge
```

The container runs `npm run setup` on start, then serves `build/server/index.js`.

## 4. Configure Shopify Partners

In the Shopify Partners dashboard for the PackBridge app:

1. Set the app URL to `SHOPIFY_APP_URL`.
2. Set redirect URLs to `SHOPIFY_APP_URL/auth/callback`.
3. Confirm the access scopes are `read_orders`, `read_products`, `read_companies`, `read_customers`.
4. Confirm webhook subscriptions include `orders/create`, `app/uninstalled`, `customers/data_request`, `customers/redact`, and `shop/redact`.
5. Install on a test shop and run a B2B order through the app before production launch.

## 5. Smoke Test

After the host is live:

1. Open the embedded app in Shopify Admin.
2. Confirm initial sync populates companies, locations, and variants.
3. Create a pack rule.
4. Save a Settings webhook URL and verify a signed payload lands at the destination.
5. Confirm the Jobs list and detail page show the normalization event and delivery status.
