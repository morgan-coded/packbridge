import {
  authenticate,
  BILLING_IS_TEST,
  PACKBRIDGE_PLAN,
} from "../shopify.server";

/**
 * Billing — wraps the template's built-in `billing` helpers.
 *
 * Instead of issuing raw `appSubscriptionCreate` GraphQL, we lean on the
 * template's `billing.require` / `billing.request` flow which handles the
 * redirect to Shopify's confirmation URL for us. The plan itself is declared
 * in `shopify.server.ts` (trialDays: 14, $99/month).
 *
 * Dev/test stores automatically receive a test charge approval screen because
 * `BILLING_IS_TEST` is derived from `NODE_ENV`.
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
    plans: [PACKBRIDGE_PLAN],
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
 * On dev stores the approval screen shows `(test)` next to the price.
 */
export async function requireBilling(billing: BillingContext): Promise<void> {
  await billing.require({
    plans: [PACKBRIDGE_PLAN],
    isTest: BILLING_IS_TEST,
    onFailure: async () =>
      billing.request({ plan: PACKBRIDGE_PLAN, isTest: BILLING_IS_TEST }),
  });
}
