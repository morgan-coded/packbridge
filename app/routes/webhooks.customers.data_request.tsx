import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

/**
 * GDPR compliance: customers/data_request.
 * PackBridge only stores order + pack rule metadata keyed by shop, not
 * personal customer data, so this is a logged no-op.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);
  console.log(`[packbridge] ${topic} received for ${shop} — no-op`);
  return new Response();
};
