# Deployment Notes

PackBridge is designed to run as a standard Shopify embedded app backed by PostgreSQL.

This public copy intentionally avoids live infrastructure IDs, deployment hostnames, app IDs, database IDs, tunnel IDs, IP addresses, and private operational notes. Set those values in the hosting provider, Shopify Partner dashboard, and environment variables for the deployment you actually control.

## Required Runtime Pieces

- Node.js runtime for the React Router server.
- PostgreSQL database reachable through `DATABASE_URL`.
- Shopify app credentials supplied through environment variables.
- Public HTTPS app URL configured in both the Shopify Partner dashboard and `shopify.app.toml`.
- Redirect URL ending in `/auth/callback`.
- Webhook routes reachable from Shopify.

## Environment Checklist

Use real values only in the host environment, never in git:

```text
SHOPIFY_API_KEY
SHOPIFY_API_SECRET
SHOPIFY_APP_URL
DATABASE_URL
SCOPES
NODE_ENV=production
```

Optional values depend on the deployment target and billing/review flow:

```text
SHOPIFY_BILLING_TEST
SHOP_CUSTOM_DOMAIN
PORT
```

## Deployment Shape

1. Provision PostgreSQL.
2. Set environment variables in the host dashboard.
3. Run `npm run setup` during release or pre-deploy so Prisma is generated and migrations are applied.
4. Run `npm run build`.
5. Start the server with `npm run start`.
6. Configure the Shopify Partner app URL and redirect URL to match the deployed HTTPS host.
7. Smoke-test install, reinstall, direct `/app` access, billing gate behavior, webhook receipt, privacy route, and OAuth callback.

## App Store Review Reminders

- Keep the Shopify app scopes read-only unless the product scope changes.
- Confirm billing runs in Shopify test mode during review.
- Use public-safe screenshots with no real merchant, customer, order, or credential data.
- Replace placeholder support, documentation, and privacy URLs before final submission.
- Keep private hosting notes out of public docs.
