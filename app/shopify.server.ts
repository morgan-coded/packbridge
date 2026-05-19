import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  BillingInterval,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";
import { runFullSync } from "./services/sync.server";
import { ensureShopSettings } from "./services/shop-settings.server";

// The Shopify app TOML declares api_version = "2026-07". The shipped
// `ApiVersion` enum in @shopify/shopify-api does not yet include July26 at the
// time of writing, so we cast the literal. All Admin GraphQL calls use this
// version by default.
const PACKBRIDGE_API_VERSION = "2026-07" as ApiVersion;

// Keep the legacy $99 plan active for existing subscriptions, and request
// the $49 Launch plan for new installs.
export const PACKBRIDGE_LAUNCH_PLAN = "PackBridge Launch";
export const PACKBRIDGE_PLAN = "PackBridge Monthly";
export const PACKBRIDGE_BILLING_PLANS = [
  PACKBRIDGE_LAUNCH_PLAN,
  PACKBRIDGE_PLAN,
] as const;
export const PACKBRIDGE_DEFAULT_PLAN = PACKBRIDGE_LAUNCH_PLAN;

export const BILLING_GATE_ENABLED = process.env.NODE_ENV === "production";

// Keep the billing gate enabled in production, but allow pre-launch App Store
// review/dev-store installs to approve Shopify test charges.
export const BILLING_IS_TEST =
  process.env.SHOPIFY_BILLING_TEST?.toLowerCase() === "true" ||
  !BILLING_GATE_ENABLED;

const configuredScopes = process.env.SCOPES?.split(",")
  .map((scope) => scope.trim())
  .filter(Boolean);
const customShopDomain = process.env.SHOP_CUSTOM_DOMAIN?.trim();

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: PACKBRIDGE_API_VERSION,
  scopes: configuredScopes,
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  // PrismaSessionStorage pulls in a transitive @shopify/shopify-api that
  // occasionally diverges from the version bundled with
  // @shopify/shopify-app-react-router, producing a spurious structural
  // mismatch on `Session.isActive`. The runtime contract is identical, so
  // we opt out of the duplicate-type check here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sessionStorage: new PrismaSessionStorage(prisma) as any,
  distribution: AppDistribution.AppStore,
  billing: {
    [PACKBRIDGE_LAUNCH_PLAN]: {
      trialDays: 14,
      lineItems: [
        {
          amount: 49,
          currencyCode: "USD",
          interval: BillingInterval.Every30Days,
        },
      ],
    },
    [PACKBRIDGE_PLAN]: {
      trialDays: 14,
      lineItems: [
        {
          amount: 99,
          currencyCode: "USD",
          interval: BillingInterval.Every30Days,
        },
      ],
    },
  },
  future: {
    expiringOfflineAccessTokens: true,
  },
  hooks: {
    afterAuth: async ({ session, admin }) => {
      // App-specific webhook subscriptions declared in shopify.app.toml are
      // registered automatically by the platform on install. We still call
      // `registerWebhooks` here to (a) pick up any shop-specific webhooks we
      // add in future phases, and (b) reconcile subscriptions if TOML drifts.
      await shopify.registerWebhooks({ session });

      // Seed shop settings (generates the outbound HMAC signing secret on
      // first install). Idempotent — safe to re-run on reinstall.
      try {
        await ensureShopSettings(session.shop);
      } catch (error) {
        console.error(
          `[packbridge] afterAuth settings bootstrap failed for ${session.shop}:`,
          error,
        );
      }

      // Kick off the initial data mirror. Runs inline so the merchant lands
      // on an app home page that already knows its company/variant counts.
      try {
        const counts = await runFullSync(admin, session.shop);
        console.log(
          `[packbridge] afterAuth sync complete for ${session.shop}:`,
          counts,
        );
      } catch (error) {
        console.error(
          `[packbridge] afterAuth sync failed for ${session.shop}:`,
          error,
        );
      }
    },
  },
  ...(customShopDomain ? { customShopDomains: [customShopDomain] } : {}),
});

export default shopify;
export const apiVersion = PACKBRIDGE_API_VERSION;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
