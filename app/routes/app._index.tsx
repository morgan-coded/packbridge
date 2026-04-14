import { useEffect } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { runFullSync } from "../services/sync.server";

interface LoaderData {
  shopDomain: string;
  companyCount: number;
  locationCount: number;
  variantCount: number;
  syncedAt: string | null;
}

export const loader = async ({
  request,
}: LoaderFunctionArgs): Promise<LoaderData> => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  const [shop, companyCount, locationCount, variantCount] = await Promise.all([
    prisma.shop.findUnique({ where: { id: shopDomain } }),
    prisma.syncedCompany.count({ where: { shopDomain } }),
    prisma.syncedCompanyLocation.count({ where: { shopDomain } }),
    prisma.syncedVariant.count({ where: { shopDomain } }),
  ]);

  return {
    shopDomain,
    companyCount,
    locationCount,
    variantCount,
    syncedAt: shop?.syncedAt ? shop.syncedAt.toISOString() : null,
  };
};

interface ActionData {
  ok: boolean;
  counts?: { companies: number; locations: number; variants: number };
  error?: string;
}

export const action = async ({
  request,
}: ActionFunctionArgs): Promise<ActionData> => {
  const { admin, session } = await authenticate.admin(request);
  try {
    const counts = await runFullSync(admin, session.shop);
    return { ok: true, counts };
  } catch (error) {
    console.error(`[packbridge] manual sync failed for ${session.shop}:`, error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

export default function Index() {
  const data = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const isSyncing =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";

  useEffect(() => {
    if (fetcher.data?.ok) {
      shopify.toast.show("Sync complete");
    } else if (fetcher.data && fetcher.data.ok === false) {
      shopify.toast.show("Sync failed — see server logs", { isError: true });
    }
  }, [fetcher.data, shopify]);

  const resync = () => fetcher.submit({}, { method: "POST" });

  const syncedLabel = data.syncedAt
    ? new Date(data.syncedAt).toLocaleString()
    : "Never";

  return (
    <s-page heading="PackBridge">
      <s-button
        slot="primary-action"
        onClick={resync}
        {...(isSyncing ? { loading: true } : {})}
      >
        Re-sync now
      </s-button>

      <s-section heading="Shop">
        <s-paragraph>
          <s-text>Shop domain: </s-text>
          <strong>{data.shopDomain}</strong>
        </s-paragraph>
        <s-paragraph>
          <s-text>Last synced: </s-text>
          <strong>{syncedLabel}</strong>
        </s-paragraph>
      </s-section>

      <s-section heading="Mirrored data">
        <s-stack direction="block" gap="base">
          <s-paragraph>
            <s-text>Companies: </s-text>
            <strong>{data.companyCount}</strong>
          </s-paragraph>
          <s-paragraph>
            <s-text>Company locations: </s-text>
            <strong>{data.locationCount}</strong>
          </s-paragraph>
          <s-paragraph>
            <s-text>Variants: </s-text>
            <strong>{data.variantCount}</strong>
          </s-paragraph>
        </s-stack>

        {fetcher.data?.ok && fetcher.data.counts && (
          <s-box
            padding="base"
            borderWidth="base"
            borderRadius="base"
            background="subdued"
          >
            <s-paragraph>
              Synced {fetcher.data.counts.companies} companies,{" "}
              {fetcher.data.counts.locations} locations, and{" "}
              {fetcher.data.counts.variants} variants.
            </s-paragraph>
          </s-box>
        )}

        {fetcher.data && fetcher.data.ok === false && (
          <s-box
            padding="base"
            borderWidth="base"
            borderRadius="base"
            background="subdued"
          >
            <s-paragraph>Sync failed: {fetcher.data.error}</s-paragraph>
          </s-box>
        )}
      </s-section>

      <s-section heading="Phase 1 checkpoint">
        <s-paragraph>
          Place a B2B test order, then open{" "}
          <s-link href="/app/test-order">the test-order route</s-link> to verify
          the purchasing-entity contract. This route is temporary and will be
          removed after Phase 1 sign-off.
        </s-paragraph>
      </s-section>

      <s-section slot="aside" heading="Scope">
        <s-paragraph>
          Phase 1 is read-only: sync, orders/create webhook logging, and the B2B
          checkpoint. Pack rules, normalization, and outbound delivery arrive in
          Phases 2–4.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
