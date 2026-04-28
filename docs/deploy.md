# DigitalOcean Deploy Runbook

PackBridge production target: DigitalOcean App Platform plus DigitalOcean
Managed Postgres. Do not run `doctl apps create`, `doctl apps update`, create a
database, push Partner Dashboard URL changes, or submit the App Store listing
until the final spec and deploy plan are approved.

## Current DigitalOcean State

Read-only inspection on 2026-04-28 found:

- Existing App Platform app: `packbridge`
  - App ID: `7473fb2a-16a6-4e55-93e6-498320121671`
  - Region: `nyc`
  - Live/default ingress: `https://packbridge-dy937.ondigitalocean.app`
  - Prior deployments failed because `SHOPIFY_APP_URL` was missing at runtime;
    the active deployment now sets it from the App Platform URL.
- Existing Managed Postgres cluster: `packbridge-db`
  - Cluster ID: `705fde3d-3426-4212-8be1-112fe4228b6a`
  - Engine/version: PostgreSQL 16
  - Region: `nyc1`
  - Tier: `db-s-1vcpu-1gb`
  - Nodes: 1
  - Status: online

No new database should be provisioned unless the existing `packbridge-db`
cluster is intentionally replaced.

## StockLock Pattern To Reuse

The local StockLock checkout was not present under the usual Documents paths,
but the live DigitalOcean app spec for `stocklock` was available via `doctl`.
Useful patterns from that app:

- App Platform region: `nyc`
- GitHub source: `morgan-coded/stocklock`, branch `main`, deploy on push
- Web service on port `3000`
- `NODE_ENV=production`
- `NPM_CONFIG_PRODUCTION=false` at build time
- Smallest App Platform instance: `basic-xxs`
- Pre-deploy migration job named `migrate`
- Database URL injected with a bindable variable like
  `${stocklock-db.DATABASE_URL}`
- Default DigitalOcean subdomain used for launch:
  `https://stocklock-jx4we.ondigitalocean.app`

For PackBridge, use the current equivalent smallest App Platform size,
`apps-s-1vcpu-0.5gb` (1 shared vCPU, 512 MB, same $5/month class as
StockLock's `basic-xxs` alias).

## Proposed PackBridge App Spec

This is the spec shape applied to the existing `packbridge` app.
Secret values must be supplied from the existing DigitalOcean app secrets or set
locally during the `doctl apps update` flow; do not commit plaintext secrets.

```yaml
# Existing Managed Postgres cluster: packbridge-db, pg16, nyc1,
# db-s-1vcpu-1gb, 1 node.
databases:
- cluster_name: packbridge-db
  engine: PG
  name: packbridge-db
  production: true
  version: "16"
ingress:
  rules:
  - component:
      name: web
    match:
      path:
        prefix: /
jobs:
- build_command: npm install
  environment_slug: node-js
  envs:
  - key: NODE_ENV
    scope: RUN_TIME
    value: production
  - key: NPM_CONFIG_PRODUCTION
    scope: BUILD_TIME
    value: "false"
  - key: DATABASE_URL
    scope: RUN_AND_BUILD_TIME
    value: ${packbridge-db.DATABASE_URL}
  github:
    branch: main
    deploy_on_push: true
    repo: morgan-coded/packbridge
  instance_count: 1
  instance_size_slug: apps-s-1vcpu-0.5gb
  kind: PRE_DEPLOY
  name: migrate
  run_command: npm run setup
  source_dir: /
name: packbridge
region: nyc
services:
- build_command: npm install && npm run build
  environment_slug: node-js
  envs:
  - key: NODE_ENV
    scope: RUN_TIME
    value: production
  - key: NPM_CONFIG_PRODUCTION
    scope: BUILD_TIME
    value: "false"
  - key: PORT
    scope: RUN_TIME
    value: "3000"
  - key: SHOPIFY_API_KEY
    scope: RUN_AND_BUILD_TIME
    type: SECRET
    value: REDACTED_SET_IN_DO
  - key: SHOPIFY_API_SECRET
    scope: RUN_AND_BUILD_TIME
    type: SECRET
    value: REDACTED_SET_IN_DO
  - key: SCOPES
    scope: RUN_AND_BUILD_TIME
    value: read_orders,read_products,read_companies,read_customers
  - key: SHOPIFY_APP_URL
    scope: RUN_TIME
    value: ${APP_URL}
  - key: SHOPIFY_BILLING_TEST
    scope: RUN_TIME
    value: "true"
  - key: DATABASE_URL
    scope: RUN_AND_BUILD_TIME
    value: ${packbridge-db.DATABASE_URL}
  github:
    branch: main
    deploy_on_push: true
    repo: morgan-coded/packbridge
  http_port: 3000
  instance_count: 1
  instance_size_slug: apps-s-1vcpu-0.5gb
  name: web
  run_command: npm run start
  source_dir: /
```

Notes:

- `${APP_URL}` is the App Platform bindable variable for the generated default
  app URL. That avoids hard-coding a custom domain before launch.
- `SHOPIFY_BILLING_TEST=true` is intended for App Store review/dev-store
  validation only. Keep it enabled before submission so Shopify can approve a
  test subscription on review stores; remove it or set it to `false` before
  opening the app to live merchants.
- The previous PackBridge DO spec did not include `SHOPIFY_APP_URL`, which is
  why the app crashed on boot after a successful build.
- `npm run setup` runs Prisma generate and migrations before the web service
  starts.
- No worker is included for PackBridge v1 because the app currently processes
  order webhooks in the web service; StockLock has a worker, but PackBridge does
  not need one yet.

## Deployment Steps

1. Confirm `main` is ready and pushed to GitHub. The local checkout may be ahead
   of `origin/main`; App Platform deploys from GitHub, not local files.
2. Apply the approved spec to the existing app:

   ```bash
   doctl apps update 7473fb2a-16a6-4e55-93e6-498320121671 \
     --spec /path/to/approved-packbridge-app.yaml
   ```

3. Wait for the pre-deploy migration job and web deployment to complete.
4. Read the generated default DigitalOcean URL from the app:

   ```bash
   doctl apps get 7473fb2a-16a6-4e55-93e6-498320121671
   ```

5. In Shopify Partners, set:
   - App URL: the generated DigitalOcean `ondigitalocean.app` URL
   - Redirect URL: `<app-url>/auth/callback`
   - Compliance webhook URLs:
     - `<app-url>/webhooks/customers/data_request`
     - `<app-url>/webhooks/customers/redact`
     - `<app-url>/webhooks/shop/redact`
   - App webhooks:
     - `<app-url>/webhooks/orders/create`
     - `<app-url>/webhooks/app/uninstalled`
6. Smoke-test on a dev store:
   - Install or reinstall the app from the production URL.
   - Confirm initial sync populates companies, locations, and variants.
   - Create a pack rule.
   - Save a Settings webhook URL and verify a signed payload lands at the
     destination.
   - Place a B2B order and confirm the Jobs list/detail page show normalization
     events and outbound delivery status.
   - Verify billing in production mode without creating an accidental live
     merchant charge during testing.

## Hard Stops

- Do not provision a new database unless replacing `packbridge-db` is approved.
- Do not run `doctl apps update` or `doctl apps create` without approval.
- Do not update Shopify Partner production URLs until the DigitalOcean deploy
  target is approved.
- Do not click Shopify App Store Submit until the final submission summary is
  approved.
