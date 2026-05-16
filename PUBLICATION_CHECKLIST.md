# Public GitHub Publication Checklist

Use this before making the repository public.

## Secret safety

- [ ] `git status --short` reviewed.
- [ ] `.env` and `.env.*` are ignored and not tracked.
- [ ] `.shopify/` and `.shopify.lock` are ignored and not tracked.
- [ ] `.cursor/`, `.vscode/`, and other local editor/tooling files are ignored and not tracked.
- [ ] No real `DATABASE_URL`, Shopify API secret, webhook signing secret, token, private key, or store access token appears in tracked files.
- [ ] Screenshots do not reveal real merchant/customer data, internal URLs, credentials, or private stores.
- [ ] Public docs avoid private GitHub links, private deployment URLs, and internal repo names.

Suggested scan:

```bash
git ls-files -co --exclude-standard \
  | grep -Ev '(^node_modules/|^build/|^dist/|\\.png$|\\.jpg$|\\.jpeg$|\\.gif$)' \
  | xargs grep -nE 'sk_live_|shpat_|shpss_|ghp_|xox[baprs]-|AKIA[0-9A-Z]{16}|BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY|DATABASE_URL=|SHOPIFY_API_SECRET|STRIPE_SECRET_KEY|SECRET_KEY|PASSWORD='
```

Review every hit. Example placeholders in `.env.example` or README setup snippets are okay; real values are not.

## Portfolio polish

- [ ] README opens with a clear product sentence.
- [ ] `docs/github-portfolio.md` explains the business problem, architecture, and proof points.
- [ ] Screenshots under `docs/screenshots/` are public-safe.
- [ ] `docs/app-store-listing.md` and `docs/app-store-readiness.md` are public-safe.
- [ ] README first screen reads as a portfolio project, not an internal launch log.
- [ ] License posture is intentional: proprietary/source-available unless changed.

## GitHub settings

- [ ] Repo description: `Shopify B2B pack-rule normalization app with signed downstream delivery.`
- [ ] Topics: `shopify`, `shopify-app`, `b2b`, `webhooks`, `prisma`, `postgresql`, `typescript`, `react-router`.
- [ ] Do not enable public issues if Morgan does not want support requests.
- [ ] Do not expose private deployment variables in GitHub Actions.

## Upwork-safe positioning

Use this repo as proof for:

- Shopify embedded app builds.
- B2B order/workflow automation.
- Webhook and API integration reliability.
- Prisma/PostgreSQL backend work.
- Signed payload delivery and audit trails.

Do not claim revenue, merchant adoption, or client outcomes unless Morgan can prove them.
