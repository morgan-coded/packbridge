import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

/**
 * GDPR compliance: shop/redact.
 * Triggered 48h after uninstall. Purges shop-scoped app data after Shopify
 * confirms the merchant's shop data should be erased.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  await db.$transaction([
    db.normalizationJob.deleteMany({ where: { shopDomain: shop } }),
    db.packRule.deleteMany({ where: { shopDomain: shop } }),
    db.ruleImportJob.deleteMany({ where: { shopDomain: shop } }),
    db.syncedCompanyLocation.deleteMany({ where: { shopDomain: shop } }),
    db.syncedCompany.deleteMany({ where: { shopDomain: shop } }),
    db.syncedVariant.deleteMany({ where: { shopDomain: shop } }),
    db.shop.deleteMany({ where: { id: shop } }),
    db.session.deleteMany({ where: { shop } }),
  ]);

  console.log(`[packbridge] ${topic} received for ${shop} — shop data purged`);
  return new Response();
};
