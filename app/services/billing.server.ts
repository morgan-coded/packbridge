import {
  authenticate,
  BILLING_GATE_ENABLED,
  BILLING_IS_TEST,
  PACKBRIDGE_BILLING_PLANS,
  PACKBRIDGE_DEFAULT_PLAN,
} from "../shopify.server";

/**
 * Billing — wraps the template's built-in `billing` helpers.
 *
 * Instead of issuing raw `appSubscriptionCreate` GraphQL, we lean on the
 * template's `billing.require` / `billing.request` flow which handles the
 * redirect to Shopify's confirmation URL for us. The plan itself is declared
 * in `shopify.server.ts` (Launch: $49/month, legacy/pro: $99/month).
 *
 * Local/dev environments skip the billing gate entirely. Production keeps the
 * gate enabled and can request Shopify test charges with
 * `SHOPIFY_BILLING_TEST=true` during App Store review/dev-store validation.
 */

// Infer the billing context type from the template so we don't have to export
// the generic `AppConfigArg` that `BillingContext<Config>` requires.
type AdminAuthResult = Awaited<ReturnType<typeof authenticate.admin>>;
type BillingContext = AdminAuthResult["billing"];

export interface ActiveSubscription {
  id: string;
  name: string;
  status: string;
  test: boolean;
}

/**
 * Non-redirecting check. Returns whether the shop has an active subscription
 * on the PackBridge plan, plus the raw subscription list. Never throws.
 */
export async function checkActiveSubscription(
  billing: BillingContext,
): Promise<{ hasActivePayment: boolean; subscriptions: ActiveSubscription[] }> {
  const check = await billing.check({
    plans: [...PACKBRIDGE_BILLING_PLANS],
    isTest: BILLING_IS_TEST,
  });
  return {
    hasActivePayment: Boolean(check.hasActivePayment),
    subscriptions: (check.appSubscriptions ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      status: s.status,
      test: BILLING_IS_TEST,
    })),
  };
}

/**
 * Required-billing gate. Call this from loaders that should be protected.
 * If no active subscription exists, this throws a redirect to the Shopify
 * billing approval URL — merchant approves, Shopify redirects back to the
 * app, and the subsequent page load will pass the gate.
 *
 * For local/dev environments we skip the gate entirely so the embedded app can
 * load even when Shopify's Billing API is unavailable to non-public apps.
 */
export async function requireBilling(billing: BillingContext): Promise<void> {
  if (!BILLING_GATE_ENABLED) {
    console.warn(
      "[packbridge] Skipping billing gate because NODE_ENV is not production.",
    );
    return;
  }

  await billing.require({
    plans: [...PACKBRIDGE_BILLING_PLANS],
    isTest: BILLING_IS_TEST,
    onFailure: async () =>
      billing.request({
        plan: PACKBRIDGE_DEFAULT_PLAN,
        isTest: BILLING_IS_TEST,
      }),
  });
}
