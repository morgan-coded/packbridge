import type { PackRule, PrismaClient } from "@prisma/client";
import prisma from "../db.server";

/**
 * Rule resolver — read-only. Given a line item's context (company, location,
 * variant, product), returns the highest-specificity matching PackRule and a
 * numeric `specificityScore`.
 *
 * Resolution priority (most specific wins):
 *
 * | Priority | Match                                  | Score |
 * | -------- | -------------------------------------- | ----- |
 * | 1        | company + location + variant           | 8     |
 * | 2        | company + variant                      | 6     |
 * | 3        | company + location + product           | 5     |
 * | 4        | company + product                      | 3     |
 * | 5        | company only (all products)            | 2     |
 * | 6        | global variant (no company)            | 1     |
 * | 7        | global product (no company, no variant)| 0.5   |
 */

export interface ResolvedRule {
  rule: PackRule | null;
  specificityScore: number;
  matchType: string;
}

export interface ValidationResult {
  status: "pass" | "warn" | "hold" | "no_rule";
  errorCode?: string;
  inputQuantity: number;
  outputQuantity?: number;
  outputUnit?: string;
  packSize?: number;
  remainder?: number;
  enforcementMode?: string;
  resolvedRuleId?: string;
  matchType?: string;
}

export type EnforcementMode = "warn" | "hold" | "normalize_only";

/**
 * Score a candidate rule against the requested context. Pure function — no DB
 * access, no time-of-day logic. Encodes the priority table above.
 */
export function scoreRule(
  rule: PackRule,
  companyId: string | null,
  companyLocationId: string | null,
  variantId: string,
  productId: string,
): number {
  let score = 0;
  if (rule.companyId && rule.companyId === companyId) score += 4;
  if (rule.companyLocationId && rule.companyLocationId === companyLocationId)
    score += 2;
  if (rule.variantId && rule.variantId === variantId) score += 2;
  else if (rule.productId && rule.productId === productId) score += 1;
  return score;
}

/**
 * Derive a readable match-type label for telemetry / UI display.
 */
export function describeMatch(
  rule: PackRule,
  companyId: string | null,
  companyLocationId: string | null,
  variantId: string,
  productId: string,
): string {
  const parts: string[] = [];
  if (rule.companyId && rule.companyId === companyId) {
    parts.push("company");
    if (rule.companyLocationId && rule.companyLocationId === companyLocationId)
      parts.push("location");
  } else {
    parts.push("global");
  }
  if (rule.variantId && rule.variantId === variantId) parts.push("variant");
  else if (rule.productId && rule.productId === productId) parts.push("product");
  else parts.push("catalog");
  return parts.join("+");
}

/**
 * Does `rule` apply to the given context at all? Mirrors the SQL OR arms below
 * so test fixtures stay in sync with query planning.
 */
export function ruleMatches(
  rule: PackRule,
  companyId: string | null,
  companyLocationId: string | null,
  variantId: string,
  productId: string,
): boolean {
  if (rule.companyId && rule.companyId !== companyId) return false;
  if (rule.companyLocationId && rule.companyLocationId !== companyLocationId)
    return false;
  if (rule.variantId && rule.variantId !== variantId) return false;
  if (rule.productId && rule.productId !== productId) return false;
  return true;
}

export interface ResolveOptions {
  /** Override `now` for deterministic tests. */
  now?: Date;
  /** Inject an alternate Prisma client (e.g. a test DB or mock). */
  client?: Pick<PrismaClient, "packRule">;
}

/**
 * Fetch candidate rules and return the one with the highest specificity score.
 *
 * The SQL narrows candidates to the seven valid match-shape combinations;
 * `scoreRule` then picks the winner. Ties are broken by `updatedAt` (newest
 * first) — a stable, predictable tiebreaker.
 */
export async function resolveRule(
  shopDomain: string,
  companyId: string | null,
  companyLocationId: string | null,
  variantId: string,
  productId: string,
  options: ResolveOptions = {},
): Promise<ResolvedRule> {
  const now = options.now ?? new Date();
  const client = options.client ?? prisma;

  // Build the OR arms for every valid rule shape. Null context values require
  // the rule's corresponding field to also be null — otherwise we'd surface
  // company-scoped rules on non-B2B orders.
  const orArms: Array<Record<string, unknown>> = [];

  if (companyId) {
    if (companyLocationId) {
      orArms.push({
        companyId,
        companyLocationId,
        variantId,
        productId: null,
      });
      orArms.push({
        companyId,
        companyLocationId,
        variantId: null,
        productId,
      });
      orArms.push({
        companyId,
        companyLocationId,
        variantId: null,
        productId: null,
      });
    }
    orArms.push({
      companyId,
      companyLocationId: null,
      variantId,
      productId: null,
    });
    orArms.push({
      companyId,
      companyLocationId: null,
      variantId: null,
      productId,
    });
    orArms.push({
      companyId,
      companyLocationId: null,
      variantId: null,
      productId: null,
    });
  }
  orArms.push({
    companyId: null,
    companyLocationId: null,
    variantId,
    productId: null,
  });
  orArms.push({
    companyId: null,
    companyLocationId: null,
    variantId: null,
    productId,
  });

  const candidates = await client.packRule.findMany({
    where: {
      shopDomain,
      active: true,
      AND: [
        { OR: [{ effectiveStart: null }, { effectiveStart: { lte: now } }] },
        { OR: [{ effectiveEnd: null }, { effectiveEnd: { gte: now } }] },
      ],
      OR: orArms,
    },
  });

  if (candidates.length === 0) {
    return { rule: null, specificityScore: 0, matchType: "no_match" };
  }

  const ranked = candidates
    .filter((rule) =>
      ruleMatches(rule, companyId, companyLocationId, variantId, productId),
    )
    .map((rule) => ({
      rule,
      score: scoreRule(rule, companyId, companyLocationId, variantId, productId),
      updatedAt: rule.updatedAt.getTime(),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.updatedAt - a.updatedAt;
    });

  if (ranked.length === 0) {
    return { rule: null, specificityScore: 0, matchType: "no_match" };
  }

  const winner = ranked[0];
  return {
    rule: winner.rule,
    specificityScore: winner.score,
    matchType: describeMatch(
      winner.rule,
      companyId,
      companyLocationId,
      variantId,
      productId,
    ),
  };
}

/**
 * Apply a rule to a line item quantity.
 *
 * - `null` rule → `no_rule` + NO_RULE_FOUND.
 * - divisible → `pass` with `outputQuantity`, `outputUnit`.
 * - not divisible → `warn` / `hold` / `warn` depending on enforcement mode,
 *   with a `remainder` field exposing the leftover base units.
 *
 * Pure function — no DB access.
 */
export function validateLineItem(
  rule: PackRule | null,
  quantity: number,
): ValidationResult {
  if (!rule) {
    return {
      status: "no_rule",
      errorCode: "NO_RULE_FOUND",
      inputQuantity: quantity,
    };
  }

  const packSize = rule.packSize;
  const remainder = quantity % packSize;

  if (remainder !== 0) {
    const mode = rule.enforcementMode as EnforcementMode;
    const status = mode === "hold" ? "hold" : "warn";
    return {
      status,
      errorCode: "NOT_DIVISIBLE",
      inputQuantity: quantity,
      packSize,
      remainder,
      outputUnit: rule.downstreamUnitCode,
      enforcementMode: rule.enforcementMode,
      resolvedRuleId: rule.id,
    };
  }

  return {
    status: "pass",
    inputQuantity: quantity,
    outputQuantity: quantity / packSize,
    outputUnit: rule.downstreamUnitCode,
    packSize,
    enforcementMode: rule.enforcementMode,
    resolvedRuleId: rule.id,
  };
}
