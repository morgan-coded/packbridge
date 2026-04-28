import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import {
  normalizeOrder,
  normalizeOrderFromContext,
} from "../services/normalizer.server";
import { deliverPayload } from "../services/outbound.server";
import {
  toCompanyGid,
  toCompanyLocationGid,
  toOrderGid,
  toProductGid,
  toVariantGid,
} from "../lib/gid.server";

/**
 * orders/create — Phase 3 live pipeline.
 *
 * Flow:
 *   1. authenticate.webhook → { shop, session, admin, payload, topic }
 *   2. Skip non-B2B orders (payload.company === null).
 *   3. Normalize inline (fast; DB queries + a single GraphQL fetch).
 *   4. Fire-and-forget outbound delivery so retries don't block the webhook
 *      response. Delivery failures are recorded in OutboundDelivery.
 *   5. Always return 200 so Shopify doesn't retry — our pipeline has its own
 *      audit log.
 */

interface OrdersCreatePayload {
  id?: number | string;
  name?: string;
  company?: {
    id?: number | string;
    location_id?: number | string;
  } | null;
  line_items?: Array<{
    id?: number | string;
    quantity?: number;
    sku?: string | null;
    variant_id?: number | string | null;
    product_id?: number | string | null;
  }>;
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload, admin, session } =
    await authenticate.webhook(request);

  console.log(`[packbridge] ${topic} received for ${shop}`);

  const body = payload as OrdersCreatePayload;
  const orderId = body.id;

  if (!body.company) {
    console.log(
      `[packbridge] order ${orderId ?? "<unknown>"} is not B2B, skipping.`,
    );
    return new Response(null, { status: 200 });
  }

  if (!session || !admin) {
    // Shop uninstalled between receiving the webhook and processing it.
    console.warn(
      `[packbridge] no session/admin for ${shop}; cannot normalize order ${orderId}`,
    );
    return new Response(null, { status: 200 });
  }

  if (orderId === undefined || orderId === null) {
    console.warn(`[packbridge] missing order id on ${topic} payload for ${shop}`);
    return new Response(null, { status: 200 });
  }

  try {
    let result;
    try {
      result = await normalizeOrder(admin, shop, String(orderId));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const looksLikeScopeFailure =
        message.includes("Access denied") ||
        message.includes("read_customers") ||
        message.includes("purchasingEntity");

      if (!looksLikeScopeFailure) {
        throw error;
      }

      console.warn(
        `[packbridge] GraphQL B2B enrichment failed for order ${orderId}; falling back to webhook payload context: ${message}`,
      );

      result = await normalizeOrderFromContext(shop, String(orderId), {
        id: toOrderGid(String(orderId)),
        name: body.name ?? `#${orderId}`,
        company: body.company?.id
          ? {
              id: toCompanyGid(body.company.id),
              name: "Unknown company",
            }
          : null,
        location: body.company?.location_id
          ? {
              id: toCompanyLocationGid(body.company.location_id),
              name: "Unknown location",
            }
          : null,
        lineItems: (body.line_items ?? []).map((line, index) => ({
          id: line.id ? String(line.id) : `${orderId}:${index}`,
          quantity: line.quantity ?? 0,
          variant:
            line.variant_id && line.product_id
              ? {
                  id: toVariantGid(line.variant_id),
                  sku: line.sku ?? null,
                  product: {
                    id: toProductGid(line.product_id),
                    title: null,
                  },
                }
              : null,
        })),
      });
    }

    console.log(
      `[packbridge] order ${orderId} normalized: ${result.overallStatus} (${result.events.length} events)`,
    );

    // Fire-and-forget outbound delivery. The function awaits retries up to
    // 21s total; we don't want to block the webhook on that. Errors are
    // persisted to OutboundDelivery, so observability is preserved.
    void deliverPayload(shop, result).catch((error) => {
      console.error(
        `[packbridge] outbound delivery for order ${orderId} threw:`,
        error,
      );
    });
  } catch (error) {
    console.error(
      `[packbridge] normalization failed for order ${orderId}:`,
      error,
    );
    // Swallow the error — the NormalizationJob is marked failed, and Shopify
    // should not keep retrying a webhook that we'll keep failing to process.
  }

  return new Response(null, { status: 200 });
};
