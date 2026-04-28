import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useEffect } from "react";
import { Outlet, useLoaderData, useNavigate, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { authenticate } from "../shopify.server";
import { requireBilling } from "../services/billing.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { billing } = await authenticate.admin(request);

  // Gate every /app/* page behind an active subscription in production.
  // During local/dev work we skip billing entirely so Shopify's Billing API
  // limitations on non-public apps don't break the embedded preview.
  await requireBilling(billing);

  // eslint-disable-next-line no-undef
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

function ensureScript(id: string, src: string): HTMLScriptElement {
  let script = document.getElementById(id) as HTMLScriptElement | null;

  if (!script) {
    script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.async = false;
    document.head.appendChild(script);
  }

  return script;
}

function AppBridgeScript({ apiKey }: { apiKey: string }) {
  const navigate = useNavigate();

  useEffect(() => {
    const appBridge = ensureScript(
      "packbridge-app-bridge",
      "https://cdn.shopify.com/shopifycloud/app-bridge.js",
    );
    appBridge.dataset.apiKey = apiKey;

    const handleNavigate = (event: Event) => {
      const href = (event.target as HTMLElement)?.getAttribute("href");
      if (href) {
        navigate(href);
      }
    };

    document.addEventListener("shopify:navigate", handleNavigate);

    return () => {
      document.removeEventListener("shopify:navigate", handleNavigate);
    };
  }, [apiKey, navigate]);

  return null;
}

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider embedded={false}>
      <AppBridgeScript apiKey={apiKey} />
      <s-app-nav>
        <s-link href="/app">Dashboard</s-link>
        <s-link href="/app/rules">Rules</s-link>
        <s-link href="/app/jobs">Jobs</s-link>
        <s-link href="/app/settings">Settings</s-link>
      </s-app-nav>
      <Outlet />
    </AppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
