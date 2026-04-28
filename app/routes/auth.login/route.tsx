import { AppProvider } from "@shopify/shopify-app-react-router/react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useActionData, useLoaderData } from "react-router";

import { login } from "../../shopify.server";
import { loginErrorMessage } from "./error.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const errors = loginErrorMessage(await login(request));

  return { errors };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const errors = loginErrorMessage(await login(request));

  return {
    errors,
  };
};

export default function Auth() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const { errors } = actionData || loaderData;

  return (
    <AppProvider embedded={false}>
      <s-page>
        <s-section heading="Log in">
          <s-text>
            Open PackBridge from Shopify Admin or the Shopify App Store to start
            the secure OAuth install flow.
          </s-text>
          {errors.shop ? (
            <s-text tone="critical">
              Shopify did not include a shop on this request. Return to Shopify
              Admin and open PackBridge again.
            </s-text>
          ) : null}
        </s-section>
      </s-page>
    </AppProvider>
  );
}
