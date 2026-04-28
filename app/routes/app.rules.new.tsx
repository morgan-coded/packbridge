import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { redirect, useActionData, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { RuleForm } from "../components/RuleForm";
import {
  optionalFormString,
  productScopeForRule,
} from "../services/form-values.server";

interface LoaderData {
  companies: Array<{ id: string; name: string }>;
  locations: Array<{ id: string; companyId: string; name: string }>;
  variants: Array<{
    id: string;
    productId: string;
    sku: string | null;
    title: string | null;
    productTitle: string | null;
  }>;
}

export const loader = async ({
  request,
}: LoaderFunctionArgs): Promise<LoaderData> => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  const [companies, locations, variants] = await Promise.all([
    prisma.syncedCompany.findMany({
      where: { shopDomain },
      orderBy: { name: "asc" },
    }),
    prisma.syncedCompanyLocation.findMany({ where: { shopDomain } }),
    prisma.syncedVariant.findMany({ where: { shopDomain } }),
  ]);

  return {
    companies: companies.map((c) => ({ id: c.id, name: c.name })),
    locations: locations.map((l) => ({
      id: l.id,
      companyId: l.companyId,
      name: l.name,
    })),
    variants: variants.map((v) => ({
      id: v.id,
      productId: v.productId,
      sku: v.sku,
      title: v.title,
      productTitle: v.productTitle,
    })),
  };
};

interface ActionData {
  error: string | null;
}

export const action = async ({
  request,
}: ActionFunctionArgs): Promise<ActionData | Response> => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  const form = await request.formData();
  const companyId = optionalFormString(form.get("companyId"));
  const companyLocationId = optionalFormString(form.get("companyLocationId"));
  const variantId = optionalFormString(form.get("variantId"));
  const productId = optionalFormString(form.get("productId"));
  const ruleProductId = productScopeForRule(variantId, productId);
  const packSizeRaw = (form.get("packSize") as string) || "";
  const downstreamUnitCode = (
    (form.get("downstreamUnitCode") as string) || ""
  ).trim();
  const enforcementMode = (form.get("enforcementMode") as string) || "warn";
  const activeRaw = form.get("active");
  const active = activeRaw === "on" || activeRaw === "true" || activeRaw !== null;
  const effectiveStart = (form.get("effectiveStart") as string) || "";
  const effectiveEnd = (form.get("effectiveEnd") as string) || "";

  const packSize = Number(packSizeRaw);
  if (!Number.isInteger(packSize) || packSize <= 0) {
    return { error: "Pack size must be a positive integer" };
  }
  if (!downstreamUnitCode) {
    return { error: "Downstream unit code is required" };
  }
  if (!["warn", "hold", "normalize_only"].includes(enforcementMode)) {
    return { error: "Invalid enforcement mode" };
  }

  const duplicate = await prisma.packRule.findFirst({
    where: {
      shopDomain,
      companyId,
      companyLocationId,
      variantId,
      productId: ruleProductId,
    },
  });
  if (duplicate) {
    return {
      error:
        "A rule with this exact scope already exists. Edit the existing rule instead.",
    };
  }

  await prisma.packRule.create({
    data: {
      shopDomain,
      companyId,
      companyLocationId: companyId ? companyLocationId : null,
      variantId,
      productId: ruleProductId,
      packSize,
      downstreamUnitCode,
      enforcementMode,
      active,
      effectiveStart: effectiveStart ? new Date(effectiveStart) : null,
      effectiveEnd: effectiveEnd ? new Date(effectiveEnd) : null,
    },
  });

  return redirect("/app/rules");
};

export default function NewRule() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <s-page heading="Create pack rule">
      <s-section heading="Scope & translation">
        <RuleForm
          companies={data.companies}
          locations={data.locations}
          variants={data.variants}
          error={actionData?.error ?? null}
          submitLabel="Create rule"
          initial={{
            companyId: "",
            companyLocationId: "",
            variantId: "",
            productId: "",
            packSize: "",
            downstreamUnitCode: "",
            enforcementMode: "warn",
            active: true,
            effectiveStart: "",
            effectiveEnd: "",
          }}
        />
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
