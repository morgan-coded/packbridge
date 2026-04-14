import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

/**
 * GDPR compliance: shop/redact.
 * Triggered 48h after uninstall. Shop-level data cleanup already happens in
 * the app/uninstalled handler (session deletion); keeping this as a logged
 * no-op for now. Extend here if we begin storing shop-linked data that
 * should be purged on shop deletion.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);
  console.log(`[packbridge] ${topic} received for ${shop} — no-op`);
  return new Response();
};
