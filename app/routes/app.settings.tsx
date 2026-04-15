import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Form, useActionData, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import {
  ensureShopSettings,
  regenerateSigningSecret,
} from "../services/shop-settings.server";

interface LoaderData {
  webhookUrl: string;
  signingSecret: string;
  defaultEnforcementMode: string;
  shopDomain: string;
}

export const loader = async ({
  request,
}: LoaderFunctionArgs): Promise<LoaderData> => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  await ensureShopSettings(shopDomain);

  const shop = await prisma.shop.findUniqueOrThrow({
    where: { id: shopDomain },
  });

  return {
    shopDomain,
    webhookUrl: shop.webhookUrl ?? "",
    signingSecret: shop.signingSecret ?? "",
    defaultEnforcementMode: shop.defaultEnforcementMode,
  };
};

interface ActionData {
  ok: boolean;
  message?: string;
  error?: string;
}

export const action = async ({
  request,
}: ActionFunctionArgs): Promise<ActionData> => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  const form = await request.formData();
  const intent = (form.get("intent") as string) || "save";

  if (intent === "regenerate") {
    await regenerateSigningSecret(shopDomain);
    return { ok: true, message: "Signing secret rotated." };
  }

  const webhookUrl = ((form.get("webhookUrl") as string) || "").trim();
  const defaultEnforcementMode =
    (form.get("defaultEnforcementMode") as string) || "warn";

  if (webhookUrl) {
    try {
      const url = new URL(webhookUrl);
      if (url.protocol !== "https:" && url.protocol !== "http:") {
        return { ok: false, error: "Webhook URL must be http:// or https://" };
      }
    } catch {
      return { ok: false, error: "Webhook URL is not a valid URL" };
    }
  }

  if (!["warn", "hold", "normalize_only"].includes(defaultEnforcementMode)) {
    return { ok: false, error: "Invalid default enforcement mode" };
  }

  await prisma.shop.update({
    where: { id: shopDomain },
    data: {
      webhookUrl: webhookUrl || null,
      defaultEnforcementMode,
    },
  });

  return { ok: true, message: "Settings saved." };
};

export default function Settings() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <s-page heading="Settings">
      {actionData?.ok && (
        <s-banner tone="success">{actionData.message}</s-banner>
      )}
      {actionData && actionData.ok === false && (
        <s-banner tone="critical" heading="Couldn’t save settings">
          <s-paragraph>{actionData.error}</s-paragraph>
        </s-banner>
      )}

      <s-section heading="Outbound webhook">
        <s-paragraph>
          PackBridge POSTs a signed JSON payload to this URL whenever a B2B
          order is normalized. Leave empty to disable delivery.
        </s-paragraph>
        <Form method="post">
          <input type="hidden" name="intent" value="save" />
          <s-stack direction="block" gap="base">
            <s-url-field
              label="Webhook destination URL"
              name="webhookUrl"
              value={data.webhookUrl}
              placeholder="https://erp.example.com/packbridge/inbound"
              details="Must be http:// or https://"
            />
            <s-select
              label="Default enforcement mode"
              name="defaultEnforcementMode"
              value={data.defaultEnforcementMode}
              details="Used as the default when creating new rules."
            >
              <s-option value="warn">Warn</s-option>
              <s-option value="hold">Hold</s-option>
              <s-option value="normalize_only">Normalize only</s-option>
            </s-select>
            <s-button type="submit" variant="primary">
              Save settings
            </s-button>
          </s-stack>
        </Form>
      </s-section>

      <s-section heading="Signing secret">
        <s-paragraph>
          Use this secret on your server to verify the{" "}
          <code>X-PackBridge-Signature</code> header. The signature is{" "}
          <code>sha256=&lt;hex HMAC of the raw request body&gt;</code>.
        </s-paragraph>
        <s-box
          padding="base"
          borderWidth="base"
          borderRadius="base"
          background="subdued"
        >
          <pre style={{ margin: 0, wordBreak: "break-all" }}>
            <code>{data.signingSecret}</code>
          </pre>
        </s-box>
        <Form
          method="post"
          onSubmit={(e) => {
            if (
              !window.confirm(
                "Rotate signing secret? Any consumers relying on the old secret will fail to verify signatures until updated.",
              )
            ) {
              e.preventDefault();
            }
          }}
        >
          <input type="hidden" name="intent" value="regenerate" />
          <s-button type="submit" variant="tertiary">
            Regenerate secret
          </s-button>
        </Form>
      </s-section>

      <s-section slot="aside" heading="Shop">
        <s-paragraph>
          <s-text>Shop domain: </s-text>
          <strong>{data.shopDomain}</strong>
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
