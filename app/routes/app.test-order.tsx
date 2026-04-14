import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { authenticate } from "../shopify.server";
import {
  fetchMostRecentOrderId,
  fetchOrderWithB2BContext,
  type OrderB2BContext,
} from "../services/orders.server";

interface LoaderData {
  orderId: string | null;
  order: OrderB2BContext | null;
  error: string | null;
}

export const loader = async ({
  request,
}: LoaderFunctionArgs): Promise<LoaderData> => {
  const { admin } = await authenticate.admin(request);

  try {
    const orderId = await fetchMostRecentOrderId(admin);
    if (!orderId) {
      return { orderId: null, order: null, error: null };
    }
    const order = await fetchOrderWithB2BContext(admin, orderId);
    return { orderId, order, error: null };
  } catch (error) {
    return {
      orderId: null,
      order: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

export default function TestOrder() {
  const { orderId, order, error } = useLoaderData<typeof loader>();

  return (
    <s-page heading="Phase 1 checkpoint: most recent order">
      <s-section heading="Summary">
        <s-paragraph>
          This route calls <strong>fetchOrderWithB2BContext</strong> against
          the most recent order to confirm the B2B purchasing-entity contract.
          Delete this route after Phase 1 sign-off.
        </s-paragraph>
        {orderId && (
          <s-paragraph>
            <s-text>Order GID: </s-text>
            <strong>{orderId}</strong>
          </s-paragraph>
        )}
        {!orderId && !error && (
          <s-paragraph>
            No orders found yet. Place a draft order or checkout order on the
            dev store and reload.
          </s-paragraph>
        )}
      </s-section>

      {error && (
        <s-section heading="Error">
          <s-box
            padding="base"
            borderWidth="base"
            borderRadius="base"
            background="subdued"
          >
            <pre style={{ margin: 0 }}>
              <code>{error}</code>
            </pre>
          </s-box>
        </s-section>
      )}

      {order && (
        <s-section heading="Order payload">
          <s-box
            padding="base"
            borderWidth="base"
            borderRadius="base"
            background="subdued"
          >
            <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
              <code>{JSON.stringify(order, null, 2)}</code>
            </pre>
          </s-box>
        </s-section>
      )}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
