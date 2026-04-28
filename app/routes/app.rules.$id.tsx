import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import {
  Form,
  redirect,
  useActionData,
  useLoaderData,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { RuleForm } from "../components/RuleForm";
import {
  optionalFormString,
  productScopeForRule,
} from "../services/form-values.server";

interface LoaderData {
  rule: {
    id: string;
    companyId: string;
    companyLocationId: string;
    variantId: string;
    productId: string;
    packSize: string;
    downstreamUnitCode: string;
    enforcementMode: "warn" | "hold" | "normalize_only";
    active: boolean;
    effectiveStart: string;
    effectiveEnd: string;
    createdAt: string;
    updatedAt: string;
  };
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
  params,
}: LoaderFunctionArgs): Promise<LoaderData> => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;
  const id = params.id!;

  const rule = await prisma.packRule.findFirst({
    where: { id, shopDomain },
  });
  if (!rule) {
    throw new Response("Rule not found", { status: 404 });
  }

  const [companies, locations, variants] = await Promise.all([
    prisma.syncedCompany.findMany({
      where: { shopDomain },
      orderBy: { name: "asc" },
    }),
    prisma.syncedCompanyLocation.findMany({ where: { shopDomain } }),
    prisma.syncedVariant.findMany({ where: { shopDomain } }),
  ]);

  const toIsoDate = (d: Date | null) =>
    d ? d.toISOString().slice(0, 10) : "";

  return {
    rule: {
      id: rule.id,
      companyId: rule.companyId ?? "",
      companyLocationId: rule.companyLocationId ?? "",
      variantId: rule.variantId ?? "",
      productId: rule.productId ?? "",
      packSize: rule.packSize.toString(),
      downstreamUnitCode: rule.downstreamUnitCode,
      enforcementMode: rule.enforcementMode as
        | "warn"
        | "hold"
        | "normalize_only",
      active: rule.active,
      effectiveStart: toIsoDate(rule.effectiveStart),
      effectiveEnd: toIsoDate(rule.effectiveEnd),
      createdAt: rule.createdAt.toISOString(),
      updatedAt: rule.updatedAt.toISOString(),
    },
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
  params,
}: ActionFunctionArgs): Promise<ActionData | Response> => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;
  const id = params.id!;

  const form = await request.formData();
  const intent = (form.get("intent") as string) || "update";

  if (intent === "delete") {
    await prisma.packRule.deleteMany({ where: { id, shopDomain } });
    return redirect("/app/rules");
  }

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
      NOT: { id },
    },
  });
  if (duplicate) {
    return {
      error:
        "Another rule with this exact scope already exists. Delete or edit that rule first.",
    };
  }

  await prisma.packRule.update({
    where: { id },
    data: {
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

export default function EditRule() {
  const { rule, companies, locations, variants } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <s-page heading={`Edit pack rule`}>
      <s-section heading="Rule details">
        <RuleForm
          companies={companies}
          locations={locations}
          variants={variants}
          initial={{
            companyId: rule.companyId,
            companyLocationId: rule.companyLocationId,
            variantId: rule.variantId,
            productId: rule.productId,
            packSize: rule.packSize,
            downstreamUnitCode: rule.downstreamUnitCode,
            enforcementMode: rule.enforcementMode,
            active: rule.active,
            effectiveStart: rule.effectiveStart,
            effectiveEnd: rule.effectiveEnd,
          }}
          error={actionData?.error ?? null}
          submitLabel="Save changes"
        />
      </s-section>

      <s-section heading="Danger zone">
        <s-paragraph>
          Deleting this rule will stop applying it to future orders. Past
          normalization events remain intact.
        </s-paragraph>
        <Form
          method="post"
          onSubmit={(e) => {
            if (!window.confirm("Delete this rule? This cannot be undone.")) {
              e.preventDefault();
            }
          }}
        >
          <input type="hidden" name="intent" value="delete" />
          <s-button type="submit" variant="primary" tone="critical">
            Delete rule
          </s-button>
        </Form>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
