import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

/**
 * orders/create webhook — Phase 1 logger only.
 *
 * Full B2B normalization happens in Phase 3. For now we just capture the
 * payload so the team can verify the B2B data contract end-to-end.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`[packbridge] ${topic} received for ${shop}`);

  interface OrderLineItem {
    id?: number | string;
    variant_id?: number | string;
    sku?: string;
    quantity?: number;
  }
  interface OrderCompany {
    id?: number | string;
    location_id?: number | string;
  }
  interface OrderCreatePayload {
    id?: number | string;
    name?: string;
    company?: OrderCompany | null;
    line_items?: OrderLineItem[];
  }

  const body = payload as OrderCreatePayload;
  const company = body.company ?? null;

  if (!company) {
    console.log(
      `[packbridge] order ${body.id ?? "<unknown>"} is not B2B, skipping.`,
    );
    return new Response();
  }

  console.log(
    `[packbridge] B2B order ${body.id ?? "<unknown>"} (${body.name ?? ""}) for ${shop}`,
    {
      companyId: company.id,
      companyLocationId: company.location_id,
      lineItems: (body.line_items ?? []).map((li) => ({
        id: li.id,
        variantId: li.variant_id,
        sku: li.sku,
        quantity: li.quantity,
      })),
    },
  );

  // Also dump the full payload for the checkpoint review.
  console.log(
    `[packbridge] full orders/create payload for ${shop}:`,
    JSON.stringify(body, null, 2),
  );

  return new Response();
};
