import "dotenv/config";
import { Prisma, PrismaClient } from "@prisma/client";
import crypto from "node:crypto";

const prisma = new PrismaClient();

const SHOP_DOMAIN =
  process.env.PACKBRIDGE_DEMO_SHOP ?? "demo-store.myshopify.com";

const DEMO_WEBHOOK_URL =
  process.env.PACKBRIDGE_DEMO_WEBHOOK_URL ??
  "https://webhook.site/packbridge-demo-redacted";

function gid(type: string, id: number): string {
  return `gid://shopify/${type}/${id}`;
}

function ago(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function payloadHash(seed: string): string {
  return crypto.createHash("sha256").update(seed).digest("hex");
}

const companies = [
  {
    id: gid("Company", 90010001),
    name: "Northwind Beverages Co.",
    externalId: "NW-BEV-001",
    locations: [
      { id: gid("CompanyLocation", 91010001), name: "Chicago Distribution" },
      { id: gid("CompanyLocation", 91010002), name: "Milwaukee Warehouse" },
    ],
  },
  {
    id: gid("Company", 90010002),
    name: "Cascade Grocers",
    externalId: "CAS-GROC-014",
    locations: [
      { id: gid("CompanyLocation", 91010003), name: "Portland DC" },
      { id: gid("CompanyLocation", 91010004), name: "Seattle North" },
    ],
  },
  {
    id: gid("Company", 90010003),
    name: "Atlas Foodservice",
    externalId: "ATL-FOOD-022",
    locations: [
      { id: gid("CompanyLocation", 91010005), name: "Denver Commissary" },
    ],
  },
  {
    id: gid("Company", 90010004),
    name: "Meridian Medical Supply",
    externalId: "MER-MED-009",
    locations: [
      { id: gid("CompanyLocation", 91010006), name: "Dallas Fulfillment" },
      { id: gid("CompanyLocation", 91010007), name: "Austin Clinic Depot" },
    ],
  },
];

const products = [
  {
    id: gid("Product", 92010001),
    title: "Sparkling Beverage Multipacks",
    variants: [
      { id: gid("ProductVariant", 93010001), sku: "NW-WATER-12", title: "12 x 12 oz sparkling water" },
      { id: gid("ProductVariant", 93010002), sku: "NW-TONIC-24", title: "24 x 8 oz tonic water" },
      { id: gid("ProductVariant", 93010003), sku: "NW-MIXER-48", title: "48-case pallet mixer" },
    ],
  },
  {
    id: gid("Product", 92010002),
    title: "Pantry Staples",
    variants: [
      { id: gid("ProductVariant", 93010004), sku: "CG-OLIVE-6", title: "6 x 1 L olive oil inner" },
      { id: gid("ProductVariant", 93010005), sku: "CG-RICE-12", title: "12 x 2 lb jasmine rice case" },
      { id: gid("ProductVariant", 93010006), sku: "CG-PASTA-24", title: "24 x 1 lb pasta case" },
    ],
  },
  {
    id: gid("Product", 92010003),
    title: "Foodservice Disposables",
    variants: [
      { id: gid("ProductVariant", 93010007), sku: "AT-NAPKINS-12", title: "12-pack napkin case" },
      { id: gid("ProductVariant", 93010008), sku: "AT-CUPS-48", title: "48-sleeve cup pallet" },
    ],
  },
  {
    id: gid("Product", 92010004),
    title: "Clinical Supply Kits",
    variants: [
      { id: gid("ProductVariant", 93010009), sku: "MM-GAUZE-24", title: "24-box gauze case" },
      { id: gid("ProductVariant", 93010010), sku: "MM-SYRINGE-50", title: "50-count syringe case" },
    ],
  },
];

const variants = products.flatMap((product) =>
  product.variants.map((variant) => ({
    id: variant.id,
    shopDomain: SHOP_DOMAIN,
    productId: product.id,
    sku: variant.sku,
    title: variant.title,
    productTitle: product.title,
    syncedAt: new Date(),
  })),
);

const variantBySku = new Map(variants.map((variant) => [variant.sku, variant]));

function variant(sku: string) {
  const match = variantBySku.get(sku);
  if (!match) throw new Error(`Missing demo variant for ${sku}`);
  return match;
}

const rules = [
  {
    id: "demo-rule-northwind-chicago-water-case",
    companyId: companies[0].id,
    companyLocationId: companies[0].locations[0].id,
    variantId: variant("NW-WATER-12").id,
    productId: null,
    packSize: 12,
    downstreamUnitCode: "CASE",
    enforcementMode: "hold",
  },
  {
    id: "demo-rule-northwind-mixer-pallet",
    companyId: companies[0].id,
    companyLocationId: null,
    variantId: variant("NW-MIXER-48").id,
    productId: null,
    packSize: 48,
    downstreamUnitCode: "PALLET",
    enforcementMode: "normalize_only",
  },
  {
    id: "demo-rule-northwind-milwaukee-beverage-product",
    companyId: companies[0].id,
    companyLocationId: companies[0].locations[1].id,
    variantId: null,
    productId: products[0].id,
    packSize: 24,
    downstreamUnitCode: "CASE",
    enforcementMode: "warn",
  },
  {
    id: "demo-rule-cascade-portland-pantry-product",
    companyId: companies[1].id,
    companyLocationId: companies[1].locations[0].id,
    variantId: null,
    productId: products[1].id,
    packSize: 12,
    downstreamUnitCode: "CASE",
    enforcementMode: "warn",
  },
  {
    id: "demo-rule-cascade-olive-inner",
    companyId: companies[1].id,
    companyLocationId: null,
    variantId: variant("CG-OLIVE-6").id,
    productId: null,
    packSize: 6,
    downstreamUnitCode: "INNER",
    enforcementMode: "normalize_only",
  },
  {
    id: "demo-rule-cascade-seattle-pasta-hold",
    companyId: companies[1].id,
    companyLocationId: companies[1].locations[1].id,
    variantId: variant("CG-PASTA-24").id,
    productId: null,
    packSize: 24,
    downstreamUnitCode: "CASE",
    enforcementMode: "hold",
  },
  {
    id: "demo-rule-atlas-company-default",
    companyId: companies[2].id,
    companyLocationId: null,
    variantId: null,
    productId: null,
    packSize: 24,
    downstreamUnitCode: "CASE",
    enforcementMode: "warn",
  },
  {
    id: "demo-rule-atlas-disposables-product",
    companyId: companies[2].id,
    companyLocationId: companies[2].locations[0].id,
    variantId: null,
    productId: products[2].id,
    packSize: 48,
    downstreamUnitCode: "PALLET",
    enforcementMode: "normalize_only",
  },
  {
    id: "demo-rule-meridian-syringe-case",
    companyId: companies[3].id,
    companyLocationId: companies[3].locations[0].id,
    variantId: variant("MM-SYRINGE-50").id,
    productId: null,
    packSize: 50,
    downstreamUnitCode: "CASE",
    enforcementMode: "hold",
  },
  {
    id: "demo-rule-meridian-clinical-product",
    companyId: companies[3].id,
    companyLocationId: null,
    variantId: null,
    productId: products[3].id,
    packSize: 24,
    downstreamUnitCode: "CASE",
    enforcementMode: "warn",
  },
  {
    id: "demo-rule-global-gauze-case",
    companyId: null,
    companyLocationId: null,
    variantId: variant("MM-GAUZE-24").id,
    productId: null,
    packSize: 24,
    downstreamUnitCode: "CASE",
    enforcementMode: "normalize_only",
  },
  {
    id: "demo-rule-global-disposables-product",
    companyId: null,
    companyLocationId: null,
    variantId: null,
    productId: products[2].id,
    packSize: 12,
    downstreamUnitCode: "CASE",
    enforcementMode: "warn",
  },
] satisfies Array<{
  id: string;
  companyId: string | null;
  companyLocationId: string | null;
  variantId: string | null;
  productId: string | null;
  packSize: number;
  downstreamUnitCode: string;
  enforcementMode: "warn" | "hold" | "normalize_only";
}>;

const ruleById = new Map(rules.map((rule) => [rule.id, rule]));

function rule(id: string) {
  const match = ruleById.get(id);
  if (!match) throw new Error(`Missing demo rule for ${id}`);
  return match;
}

interface DemoEvent {
  lineItemId: string;
  sku: string;
  inputQuantity: number;
  ruleId: string;
  outputQuantity: string | null;
  resultStatus: "pass" | "warn" | "hold";
  errorCode?: string;
  remainder?: number;
}

interface DemoJob {
  id: string;
  orderId: string;
  orderName: string;
  companyId: string;
  companyLocationId: string;
  status: "completed" | "held" | "mixed";
  errorSummary?: string;
  createdAt: Date;
  processedAt: Date;
  events: DemoEvent[];
  delivery: {
    retryCount: number;
    deliveryStatus: "delivered";
    lastError: string | null;
  };
}

const jobs: DemoJob[] = [
  {
    id: "demo-job-10241",
    orderId: gid("Order", 94010001),
    orderName: "#10241",
    companyId: companies[0].id,
    companyLocationId: companies[0].locations[0].id,
    status: "completed",
    createdAt: ago(4),
    processedAt: ago(3.95),
    events: [
      {
        lineItemId: gid("LineItem", 95010001),
        sku: "NW-WATER-12",
        inputQuantity: 120,
        ruleId: "demo-rule-northwind-chicago-water-case",
        outputQuantity: "10",
        resultStatus: "pass",
      },
      {
        lineItemId: gid("LineItem", 95010002),
        sku: "NW-MIXER-48",
        inputQuantity: 96,
        ruleId: "demo-rule-northwind-mixer-pallet",
        outputQuantity: "2",
        resultStatus: "pass",
      },
    ],
    delivery: { retryCount: 0, deliveryStatus: "delivered", lastError: null },
  },
  {
    id: "demo-job-10242",
    orderId: gid("Order", 94010002),
    orderName: "#10242",
    companyId: companies[1].id,
    companyLocationId: companies[1].locations[1].id,
    status: "held",
    errorSummary: "One line is not divisible by the required case pack.",
    createdAt: ago(3),
    processedAt: ago(2.97),
    events: [
      {
        lineItemId: gid("LineItem", 95010003),
        sku: "CG-PASTA-24",
        inputQuantity: 50,
        ruleId: "demo-rule-cascade-seattle-pasta-hold",
        outputQuantity: null,
        resultStatus: "hold",
        errorCode: "NOT_DIVISIBLE",
        remainder: 2,
      },
    ],
    delivery: { retryCount: 0, deliveryStatus: "delivered", lastError: null },
  },
  {
    id: "demo-job-10243",
    orderId: gid("Order", 94010003),
    orderName: "#10243",
    companyId: companies[2].id,
    companyLocationId: companies[2].locations[0].id,
    status: "mixed",
    createdAt: ago(2),
    processedAt: ago(1.96),
    events: [
      {
        lineItemId: gid("LineItem", 95010004),
        sku: "AT-CUPS-48",
        inputQuantity: 96,
        ruleId: "demo-rule-atlas-disposables-product",
        outputQuantity: "2",
        resultStatus: "pass",
      },
      {
        lineItemId: gid("LineItem", 95010005),
        sku: "AT-NAPKINS-12",
        inputQuantity: 30,
        ruleId: "demo-rule-global-disposables-product",
        outputQuantity: null,
        resultStatus: "warn",
        errorCode: "NOT_DIVISIBLE",
        remainder: 6,
      },
    ],
    delivery: { retryCount: 0, deliveryStatus: "delivered", lastError: null },
  },
  {
    id: "demo-job-10244",
    orderId: gid("Order", 94010004),
    orderName: "#10244",
    companyId: companies[3].id,
    companyLocationId: companies[3].locations[0].id,
    status: "completed",
    createdAt: ago(1),
    processedAt: ago(0.94),
    events: [
      {
        lineItemId: gid("LineItem", 95010006),
        sku: "MM-SYRINGE-50",
        inputQuantity: 150,
        ruleId: "demo-rule-meridian-syringe-case",
        outputQuantity: "3",
        resultStatus: "pass",
      },
      {
        lineItemId: gid("LineItem", 95010007),
        sku: "MM-GAUZE-24",
        inputQuantity: 72,
        ruleId: "demo-rule-global-gauze-case",
        outputQuantity: "3",
        resultStatus: "pass",
      },
    ],
    delivery: {
      retryCount: 1,
      deliveryStatus: "delivered",
      lastError: "First attempt returned HTTP 500; retry delivered.",
    },
  },
  {
    id: "demo-job-10245",
    orderId: gid("Order", 94010005),
    orderName: "#10245",
    companyId: companies[1].id,
    companyLocationId: companies[1].locations[0].id,
    status: "completed",
    createdAt: ago(0.3),
    processedAt: ago(0.26),
    events: [
      {
        lineItemId: gid("LineItem", 95010008),
        sku: "CG-RICE-12",
        inputQuantity: 144,
        ruleId: "demo-rule-cascade-portland-pantry-product",
        outputQuantity: "12",
        resultStatus: "pass",
      },
      {
        lineItemId: gid("LineItem", 95010009),
        sku: "CG-OLIVE-6",
        inputQuantity: 54,
        ruleId: "demo-rule-cascade-olive-inner",
        outputQuantity: "9",
        resultStatus: "pass",
      },
    ],
    delivery: { retryCount: 0, deliveryStatus: "delivered", lastError: null },
  },
];

async function resetShopData() {
  const existingJobs = await prisma.normalizationJob.findMany({
    where: { shopDomain: SHOP_DOMAIN },
    select: { id: true },
  });
  const jobIds = [...new Set([...existingJobs.map((job) => job.id), ...jobs.map((job) => job.id)])];
  const companyIds = companies.map((company) => company.id);
  const companyLocationIds = companies.flatMap((company) =>
    company.locations.map((location) => location.id),
  );
  const variantIds = variants.map((variant) => variant.id);
  const ruleIds = rules.map((packRule) => packRule.id);

  await prisma.$transaction([
    prisma.outboundDelivery.deleteMany({
      where: { normalizationJobId: { in: jobIds } },
    }),
    prisma.normalizationEvent.deleteMany({
      where: { normalizationJobId: { in: jobIds } },
    }),
    prisma.normalizationJob.deleteMany({
      where: { OR: [{ shopDomain: SHOP_DOMAIN }, { id: { in: jobIds } }] },
    }),
    prisma.ruleImportJob.deleteMany({
      where: {
        OR: [{ shopDomain: SHOP_DOMAIN }, { id: "demo-import-spring-2026" }],
      },
    }),
    prisma.packRule.deleteMany({
      where: { OR: [{ shopDomain: SHOP_DOMAIN }, { id: { in: ruleIds } }] },
    }),
    prisma.syncedCompanyLocation.deleteMany({
      where: {
        OR: [{ shopDomain: SHOP_DOMAIN }, { id: { in: companyLocationIds } }],
      },
    }),
    prisma.syncedCompany.deleteMany({
      where: { OR: [{ shopDomain: SHOP_DOMAIN }, { id: { in: companyIds } }] },
    }),
    prisma.syncedVariant.deleteMany({
      where: { OR: [{ shopDomain: SHOP_DOMAIN }, { id: { in: variantIds } }] },
    }),
  ]);
}

async function seed() {
  await resetShopData();

  const syncedAt = new Date();

  await prisma.shop.upsert({
    where: { id: SHOP_DOMAIN },
    update: {
      name: "PackBridge Demo",
      plan: "development",
      currency: "USD",
      webhookUrl: DEMO_WEBHOOK_URL,
      signingSecret: "pb_demo_secret_replace_before_launch",
      defaultEnforcementMode: "warn",
      syncedAt,
    },
    create: {
      id: SHOP_DOMAIN,
      name: "PackBridge Demo",
      plan: "development",
      currency: "USD",
      webhookUrl: DEMO_WEBHOOK_URL,
      signingSecret: "pb_demo_secret_replace_before_launch",
      defaultEnforcementMode: "warn",
      syncedAt,
    },
  });

  await prisma.syncedCompany.createMany({
    data: companies.map((company) => ({
      id: company.id,
      shopDomain: SHOP_DOMAIN,
      name: company.name,
      externalId: company.externalId,
      syncedAt,
    })),
  });

  await prisma.syncedCompanyLocation.createMany({
    data: companies.flatMap((company) =>
      company.locations.map((location) => ({
        id: location.id,
        companyId: company.id,
        shopDomain: SHOP_DOMAIN,
        name: location.name,
        syncedAt,
      })),
    ),
  });

  await prisma.syncedVariant.createMany({ data: variants });

  await prisma.packRule.createMany({
    data: rules.map((packRule, index) => ({
      ...packRule,
      shopDomain: SHOP_DOMAIN,
      active: true,
      createdAt: ago(36 - index),
    })),
  });

  await prisma.ruleImportJob.create({
    data: {
      id: "demo-import-spring-2026",
      shopDomain: SHOP_DOMAIN,
      fileName: "packbridge-spring-rules.csv",
      totalRows: 5,
      successCount: 4,
      errorCount: 1,
      status: "succeeded",
      createdAt: ago(30),
      completedAt: ago(29.95),
      errors: [
        {
          row: 6,
          errors: ["SKU \"CG-PASTA-20\" not found in synced variants"],
          raw: {
            company_name: "Cascade Grocers",
            company_location_name: "Seattle North",
            sku: "CG-PASTA-20",
            pack_size: "20",
            downstream_unit_code: "CASE",
            enforcement_mode: "warn",
          },
        },
      ] satisfies Prisma.JsonArray,
    },
  });

  for (const job of jobs) {
    await prisma.normalizationJob.create({
      data: {
        id: job.id,
        shopDomain: SHOP_DOMAIN,
        orderId: job.orderId,
        orderName: job.orderName,
        companyId: job.companyId,
        companyLocationId: job.companyLocationId,
        status: job.status,
        idempotencyKey: `demo:${SHOP_DOMAIN}:${job.orderId}`,
        errorSummary: job.errorSummary ?? null,
        createdAt: job.createdAt,
        processedAt: job.processedAt,
        events: {
          create: job.events.map((event, index) => {
            const resolvedRule = rule(event.ruleId);
            const matchedVariant = variant(event.sku);
            return {
              lineItemId: event.lineItemId,
              variantId: matchedVariant.id,
              sku: event.sku,
              inputQuantity: event.inputQuantity,
              resolvedRuleId: resolvedRule.id,
              packSize: resolvedRule.packSize,
              outputQuantity: event.outputQuantity
                ? new Prisma.Decimal(event.outputQuantity)
                : null,
              outputUnit: resolvedRule.downstreamUnitCode,
              resultStatus: event.resultStatus,
              errorCode: event.errorCode ?? null,
              remainder: event.remainder ?? null,
              enforcementMode: resolvedRule.enforcementMode,
              createdAt: new Date(job.createdAt.getTime() + index * 1000),
            };
          }),
        },
        deliveries: {
          create: {
            destinationType: "webhook",
            destinationRef: DEMO_WEBHOOK_URL,
            payloadHash: payloadHash(job.id),
            deliveryStatus: job.delivery.deliveryStatus,
            retryCount: job.delivery.retryCount,
            lastError: job.delivery.lastError,
            createdAt: job.createdAt,
            deliveredAt:
              job.delivery.deliveryStatus === "delivered"
                ? job.processedAt
                : null,
          },
        },
      },
    });
  }

  console.log(
    JSON.stringify(
      {
        shop: SHOP_DOMAIN,
        companies: companies.length,
        locations: companies.reduce(
          (count, company) => count + company.locations.length,
          0,
        ),
        variants: variants.length,
        packRules: rules.length,
        jobs: jobs.length,
        webhookUrl: DEMO_WEBHOOK_URL,
      },
      null,
      2,
    ),
  );
}

seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
