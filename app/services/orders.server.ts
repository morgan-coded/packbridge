import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { toOrderGid, type NumericIdLike } from "../lib/gid.server";

type Admin = AdminApiContext;

const ORDER_B2B_QUERY = `#graphql
  query PackBridgeOrderB2BContext($orderId: ID!) {
    order(id: $orderId) {
      id
      name
      lineItems(first: 100) {
        edges {
          node {
            id
            quantity
            variant {
              id
              sku
              title
              product {
                id
                title
              }
            }
          }
        }
      }
    }
  }
`;

export interface OrderB2BContext {
  id: string;
  name: string;
  purchasingEntity?: null;
  lineItems: Array<{
    id: string;
    quantity: number;
    variant: {
      id: string;
      sku: string | null;
      title: string | null;
      product: { id: string; title: string };
    } | null;
  }>;
}

interface GraphQLEnvelope<TData> {
  data?: TData;
  errors?: unknown;
}

interface OrderQueryResponse {
  order: {
    id: string;
    name: string;
    purchasingEntity: OrderB2BContext["purchasingEntity"];
    lineItems: {
      edges: Array<{ node: OrderB2BContext["lineItems"][number] }>;
    };
  } | null;
}

interface RecentOrderResponse {
  orders: {
    edges: Array<{ node: { id: string } }>;
  };
}

/**
 * Fetch an order with B2B purchasing entity context (company + location) and
 * flattened line items. Accepts either a GID or numeric ID.
 */
export async function fetchOrderWithB2BContext(
  admin: Admin,
  orderId: NumericIdLike,
): Promise<OrderB2BContext | null> {
  const gid = toOrderGid(orderId);
  const response = await admin.graphql(ORDER_B2B_QUERY, {
    variables: { orderId: gid },
  });
  const body = (await response.json()) as GraphQLEnvelope<OrderQueryResponse>;

  if (body.errors) {
    throw new Error(
      `fetchOrderWithB2BContext GraphQL error: ${JSON.stringify(body.errors)}`,
    );
  }

  const order = body.data?.order;
  if (!order) return null;

  return {
    id: order.id,
    name: order.name,
    purchasingEntity: order.purchasingEntity ?? null,
    lineItems: (order.lineItems?.edges ?? []).map((edge) => edge.node),
  };
}

/**
 * Fetch the shop's most recent order GID (any purchasing entity type).
 * Used by the Phase 1 checkpoint route.
 */
const MOST_RECENT_ORDER_QUERY = `#graphql
  query PackBridgeMostRecentOrder {
    orders(first: 1, sortKey: CREATED_AT, reverse: true) {
      edges { node { id } }
    }
  }
`;

export async function fetchMostRecentOrderId(
  admin: Admin,
): Promise<string | null> {
  const response = await admin.graphql(MOST_RECENT_ORDER_QUERY);
  const body = (await response.json()) as GraphQLEnvelope<RecentOrderResponse>;
  const edges = body.data?.orders?.edges ?? [];
  return edges[0]?.node?.id ?? null;
}
