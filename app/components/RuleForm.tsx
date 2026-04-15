import { useState } from "react";
import { Form } from "react-router";

export interface CompanyOption {
  id: string;
  name: string;
}

export interface LocationOption {
  id: string;
  companyId: string;
  name: string;
}

export interface VariantOption {
  id: string;
  productId: string;
  sku: string | null;
  title: string | null;
  productTitle: string | null;
}

export interface RuleFormInitial {
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
}

export interface RuleFormProps {
  companies: CompanyOption[];
  locations: LocationOption[];
  variants: VariantOption[];
  initial: RuleFormInitial;
  error?: string | null;
  submitLabel: string;
  action?: string;
  method?: "post" | "put";
  extraActions?: React.ReactNode;
}

export function variantLabel(v: VariantOption): string {
  const product = v.productTitle ?? "Untitled product";
  const variant = v.title ?? "Default";
  const sku = v.sku ? ` (${v.sku})` : "";
  return `${product} — ${variant}${sku}`;
}

export function RuleForm({
  companies,
  locations,
  variants,
  initial,
  error,
  submitLabel,
  action,
  method = "post",
  extraActions,
}: RuleFormProps) {
  const [companyId, setCompanyId] = useState(initial.companyId);
  const [variantQuery, setVariantQuery] = useState("");
  const [selectedVariantId, setSelectedVariantId] = useState(
    initial.variantId ?? "",
  );
  const [selectedProductId, setSelectedProductId] = useState(
    initial.productId ?? "",
  );

  const filteredLocations = locations.filter((l) => l.companyId === companyId);

  const preselectedVariant = variants.find((v) => v.id === selectedVariantId);
  const filteredVariants = variantQuery
    ? variants
        .filter((v) => {
          const hay = `${v.sku ?? ""} ${v.productTitle ?? ""} ${v.title ?? ""}`.toLowerCase();
          return hay.includes(variantQuery.toLowerCase());
        })
        .slice(0, 50)
    : preselectedVariant
      ? [preselectedVariant]
      : [];

  return (
    <Form method={method} action={action}>
      {error && (
        <s-banner tone="critical" heading="Couldn’t save rule">
          <s-paragraph>{error}</s-paragraph>
        </s-banner>
      )}

      <s-stack direction="block" gap="large">
        <s-select
          label="Company"
          name="companyId"
          value={companyId}
          onChange={(e) => {
            setCompanyId(e.currentTarget.value);
          }}
          details="Leave empty to apply the rule to all companies."
        >
          <s-option value="">All companies</s-option>
          {companies.map((c) => (
            <s-option key={c.id} value={c.id}>
              {c.name}
            </s-option>
          ))}
        </s-select>

        {companyId && (
          <s-select
            label="Company location"
            name="companyLocationId"
            value={initial.companyLocationId}
            details="Leave empty to apply to all locations for this company."
          >
            <s-option value="">All locations</s-option>
            {filteredLocations.map((l) => (
              <s-option key={l.id} value={l.id}>
                {l.name}
              </s-option>
            ))}
          </s-select>
        )}

        <s-stack direction="block" gap="small">
          <s-search-field
            label="Search product or SKU"
            value={variantQuery}
            onInput={(e) => setVariantQuery(e.currentTarget.value)}
            details="Leave empty to apply the rule to all products in the selected scope."
          />
          {filteredVariants.length > 0 && (
            <s-select
              label="Matching variants"
              name="variantId"
              value={selectedVariantId}
              onChange={(e) => {
                setSelectedVariantId(e.currentTarget.value);
                const match = variants.find(
                  (v) => v.id === e.currentTarget.value,
                );
                setSelectedProductId(match?.productId ?? "");
              }}
            >
              <s-option value="">None (apply to all products)</s-option>
              {filteredVariants.map((v) => (
                <s-option key={v.id} value={v.id}>
                  {variantLabel(v)}
                </s-option>
              ))}
            </s-select>
          )}
          <input type="hidden" name="productId" value={selectedProductId} />
        </s-stack>

        <s-number-field
          label="Pack size"
          name="packSize"
          required
          min={1}
          step={1}
          value={initial.packSize}
          details="Base units per downstream unit (e.g. 12 means 12 each = 1 case)."
        />

        <s-text-field
          label="Downstream unit code"
          name="downstreamUnitCode"
          required
          value={initial.downstreamUnitCode}
          details="Free text — match what the ERP expects (CASE, INNER, PALLET, CTN)."
        />

        <s-select
          label="Enforcement mode"
          name="enforcementMode"
          value={initial.enforcementMode}
        >
          <s-option value="warn">Warn — order proceeds, flagged for review</s-option>
          <s-option value="hold">Hold — order held until reviewed</s-option>
          <s-option value="normalize_only">
            Normalize only — translation emitted with warnings if not divisible
          </s-option>
        </s-select>

        <s-switch
          label="Active"
          name="active"
          defaultChecked={initial.active}
        />

        <s-stack direction="inline" gap="base">
          <s-date-field
            label="Effective start"
            name="effectiveStart"
            value={initial.effectiveStart}
            details="Optional — leave empty for always active."
          />
          <s-date-field
            label="Effective end"
            name="effectiveEnd"
            value={initial.effectiveEnd}
            details="Optional."
          />
        </s-stack>

        <s-stack direction="inline" gap="base">
          <s-button type="submit" variant="primary">
            {submitLabel}
          </s-button>
          <s-button href="/app/rules" variant="tertiary">
            Cancel
          </s-button>
          {extraActions}
        </s-stack>
      </s-stack>
    </Form>
  );
}
